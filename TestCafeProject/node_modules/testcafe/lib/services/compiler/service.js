"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const compiler_1 = __importDefault(require("../../compiler"));
const test_run_proxy_1 = __importDefault(require("./test-run-proxy"));
const test_controller_1 = __importDefault(require("../../api/test-controller"));
const test_structure_1 = require("../serialization/test-structure");
const io_1 = require("./io");
const proxy_1 = require("../utils/ipc/proxy");
const transport_1 = require("../utils/ipc/transport");
const protocol_1 = require("./protocol");
const process_title_1 = __importDefault(require("../process-title"));
const hook_method_names_1 = __importDefault(require("../../api/request-hooks/hook-method-names"));
const testcafe_hammerhead_1 = require("testcafe-hammerhead");
const user_variables_1 = __importDefault(require("../../api/user-variables"));
const execute_js_expression_1 = require("../../test-run/execute-js-expression");
const test_run_1 = require("../../errors/test-run");
const utils_1 = require("../../errors/test-run/render-error-template/utils");
const setup_sourcemap_support_1 = __importDefault(require("../../utils/setup-sourcemap-support"));
const handle_errors_1 = require("../../utils/handle-errors");
const errors_1 = require("../../shared/errors");
const lodash_1 = require("lodash");
(0, setup_sourcemap_support_1.default)();
// This is hack for supporting the 'import { t } from "testcafe"' expression in tests.
// It caused by using the 'esm' module.
require('../../api/test-controller/proxy');
class CompilerService {
    constructor() {
        process.title = process_title_1.default.service;
        const input = fs_1.default.createReadStream('', { fd: io_1.SERVICE_INPUT_FD });
        const output = fs_1.default.createWriteStream('', { fd: io_1.SERVICE_OUTPUT_FD });
        this.proxy = new proxy_1.IPCProxy(new transport_1.ServiceTransport(input, output, io_1.SERVICE_SYNC_FD));
        this.state = this._initState();
        this._runnableConfigurationUnitsRelations = {};
        this._registerErrorHandlers();
        this._setupRoutes();
        this.ready();
    }
    _initState() {
        return {
            testRuns: {},
            fixtureCtxs: {},
            units: {},
            options: {},
            roles: new Map(),
        };
    }
    async _handleUnexpectedError(ErrorCtor, error) {
        const message = (0, handle_errors_1.formatError)(ErrorCtor, error);
        const type = ErrorCtor.name;
        await this.addUnexpectedError({ type, message });
    }
    _registerErrorHandlers() {
        process.on('unhandledRejection', async (e) => this._handleUnexpectedError(test_run_1.UnhandledPromiseRejectionError, e));
        process.on('uncaughtException', async (e) => this._handleUnexpectedError(test_run_1.UncaughtExceptionError, e));
    }
    _getFixtureCtx(unit) {
        const fixtureId = (0, test_structure_1.isTest)(unit) ? unit.fixture.id : unit.id;
        return this.state.fixtureCtxs[fixtureId];
    }
    _getTestCtx({ testRunId }, unit) {
        const testRunProxy = this._getTargetTestRun(testRunId);
        testRunProxy.fixtureCtx = this._getFixtureCtx(unit);
        return testRunProxy;
    }
    _getContext(args, unit) {
        const { testRunId } = args;
        if (testRunId)
            return this._getTestCtx(args, unit);
        return this._getFixtureCtx(unit);
    }
    _setupRoutes() {
        this.proxy.register([
            this.getTests,
            this.runTestFn,
            this.cleanUp,
            this.setUserVariables,
            this.setOptions,
            this.onRequestHookEvent,
            this.setMock,
            this.setConfigureResponseEventOptions,
            this.setHeaderOnConfigureResponseEvent,
            this.removeHeaderOnConfigureResponseEvent,
            this.executeRequestFilterRulePredicate,
            this.executeMockPredicate,
            this.getWarningMessages,
            this.addRequestEventListeners,
            this.removeRequestEventListeners,
            this.initializeTestRunData,
            this.getAssertionActualValue,
            this.executeRoleInitFn,
            this.getCtx,
            this.getFixtureCtx,
            this.setCtx,
            this.setFixtureCtx,
            this.updateRoleProperty,
            this.executeJsExpression,
            this.executeAsyncJsExpression,
            this.addUnexpectedError,
            this.checkWindow,
            this.removeTestRunFromState,
            this.removeFixtureCtxsFromState,
            this.removeUnitsFromState,
        ], this);
    }
    _getFunction(unit, functionName) {
        if ((0, test_structure_1.isTest)(unit) && (0, protocol_1.isTestFunctionProperty)(functionName))
            return unit[functionName];
        if ((0, test_structure_1.isFixture)(unit) && (0, protocol_1.isFixtureFunctionProperty)(functionName))
            return unit[functionName];
        throw new Error(`Cannot find '${functionName}' function for ${typeof unit}`);
    }
    _wrapEventMethods({ name, testId, hookId, eventData }) {
        if (name === hook_method_names_1.default.onRequest)
            this._wrapSetMockFn({ testId, hookId, event: eventData });
        else if (name === hook_method_names_1.default._onConfigureResponse)
            this._wrapConfigureResponseEventMethods(eventData);
    }
    _wrapSetMockFn({ testId, hookId, event }) {
        event.setMock = async (mock) => {
            await this.setMock({
                responseEventId: event.id,
                ruleId: event.requestFilterRule.id,
                testId,
                hookId,
                mock,
            });
        };
    }
    _wrapConfigureResponseEventMethods(event) {
        event.setHeader = async (name, value) => {
            await this.setHeaderOnConfigureResponseEvent({
                eventId: event.id,
                headerName: name,
                headerValue: value,
            });
        };
        event.removeHeader = async (name) => {
            await this.removeHeaderOnConfigureResponseEvent({
                eventId: event.id,
                headerName: name,
            });
        };
    }
    _initializeTestRunProxy({ testRunId, test, browser, activeWindowId, messageBus }) {
        const testRunProxy = new test_run_proxy_1.default({
            dispatcher: this,
            id: testRunId,
            options: this.state.options,
            test,
            browser,
            activeWindowId,
            messageBus,
        });
        this.state.testRuns[testRunId] = testRunProxy;
    }
    _initializeFixtureCtx(test) {
        const fixtureId = test.fixture.id;
        if (this.state.fixtureCtxs[fixtureId])
            return;
        this.state.fixtureCtxs[fixtureId] = Object.create(null);
    }
    _getTargetTestRun(testRunId) {
        return this.state.testRuns[testRunId];
    }
    _getTargetRole(roleId) {
        return this.state.roles.get(roleId);
    }
    async setUserVariables(value) {
        user_variables_1.default.value = value;
    }
    _getUnitIds(tests) {
        const testIds = tests.map(test => test.id);
        const fixtureIds = tests.map(test => { var _a; return (_a = test.fixture) === null || _a === void 0 ? void 0 : _a.id; });
        const testFileIds = tests.map(test => test.testFile.id);
        return (0, lodash_1.uniq)([...testIds, ...fixtureIds, ...testFileIds]);
    }
    async setOptions({ value }) {
        this.state.options = value;
    }
    async ready() {
        this.proxy.call(this.ready);
    }
    async cleanUp() {
        await compiler_1.default.cleanUp();
    }
    async getTests({ sourceList, compilerOptions, runnableConfigurationId }, baseUrl) {
        const compiler = new compiler_1.default(sourceList, compilerOptions, { isCompilerServiceMode: true, baseUrl });
        const tests = await compiler.getTests();
        const units = (0, test_structure_1.flatten)(tests);
        const unitIds = this._getUnitIds(tests);
        this._runnableConfigurationUnitsRelations[runnableConfigurationId] = unitIds;
        Object.assign(this.state.units, units);
        return (0, test_structure_1.serialize)(units);
    }
    async runTestFn(args) {
        const { id, functionName } = args;
        const unit = this.state.units[id];
        const context = this._getContext(args, unit);
        const functionObject = this._getFunction(unit, functionName);
        if (!functionObject)
            throw new Error(`Cannot find the "${functionName}" of ${typeof unit}`);
        return await functionObject(context);
    }
    executeCommandSync({ id, command, callsite }) {
        return this.proxy.callSync(this.executeCommand, { id, command, callsite });
    }
    async executeCommand({ command, id, callsite }) {
        return this.proxy.call(this.executeCommand, { id, command, callsite });
    }
    async onRequestHookEvent({ name, testId, hookId, eventData }) {
        this._wrapEventMethods({ name, testId, hookId, eventData });
        const test = this.state.units[testId];
        const targetHook = test.requestHooks.find(hook => hook.id === hookId);
        // @ts-ignore
        await targetHook[name].call(targetHook, eventData);
        if (name === hook_method_names_1.default._onConfigureResponse && targetHook._responseEventConfigureOpts) {
            const { opts, id: eventId } = eventData;
            await this.setConfigureResponseEventOptions({ eventId, opts });
        }
    }
    async setMock({ testId, hookId, ruleId, responseEventId, mock }) {
        await this.proxy.call(this.setMock, { testId, hookId, ruleId, responseEventId, mock });
    }
    async setConfigureResponseEventOptions({ eventId, opts }) {
        await this.proxy.call(this.setConfigureResponseEventOptions, { eventId, opts });
    }
    async setHeaderOnConfigureResponseEvent({ eventId, headerName, headerValue }) {
        await this.proxy.call(this.setHeaderOnConfigureResponseEvent, { eventId, headerName, headerValue });
    }
    async removeHeaderOnConfigureResponseEvent({ eventId, headerName }) {
        await this.proxy.call(this.removeHeaderOnConfigureResponseEvent, { eventId, headerName });
    }
    async executeRequestFilterRulePredicate({ testId, hookId, ruleId, requestInfo }) {
        const test = this.state.units[testId];
        const targetHook = test.requestHooks.find(hook => hook.id === hookId);
        const targetRule = targetHook._requestFilterRules.find(rule => rule.id === ruleId);
        const result = await targetRule.options.call(targetRule, requestInfo);
        return !!result;
    }
    async executeMockPredicate({ testId, hookId, ruleId, requestInfo, res }) {
        const test = this.state.units[testId];
        const requestMock = test.requestHooks.find(hook => hook.id === hookId);
        const responseMock = requestMock.mocks.get(ruleId);
        testcafe_hammerhead_1.responseMockSetBodyMethod.add(res);
        res = Object.assign(res, await responseMock.body(requestInfo, res));
        testcafe_hammerhead_1.responseMockSetBodyMethod.remove(res);
        return res;
    }
    async getWarningMessages({ testRunId }) {
        // NOTE: In case of raising an error into ReporterPluginHost methods,
        // TestRun has time to start.
        const targetTestRun = this._getTargetTestRun(testRunId);
        return targetTestRun ? targetTestRun.warningLog.messageInfos : [];
    }
    async addRequestEventListeners({ hookId, hookClassName, rules }) {
        return await this.proxy.call(this.addRequestEventListeners, { hookId, hookClassName, rules });
    }
    async removeRequestEventListeners({ rules }) {
        return await this.proxy.call(this.removeRequestEventListeners, { rules });
    }
    async initializeTestRunData({ testRunId, testId, browser, activeWindowId, messageBus }) {
        // NOTE: In case of raising an error into ReporterPluginHost methods,
        // TestRun has time to start.
        const test = this.state.units[testId];
        if (!test)
            return;
        this._initializeTestRunProxy({ testRunId, test, browser, activeWindowId, messageBus });
        this._initializeFixtureCtx(test);
    }
    enableDebugForNonDebugCommands() {
        test_controller_1.default.enableDebugForNonDebugCommands();
    }
    disableDebugForNonDebugCommands() {
        test_controller_1.default.disableDebugForNonDebugCommands();
    }
    async getAssertionActualValue({ testRunId, commandId }) {
        return this._getTargetTestRun(testRunId).getAssertionActualValue(commandId);
    }
    async executeRoleInitFn({ testRunId, roleId }) {
        const role = this._getTargetRole(roleId);
        const testRunProxy = this._getTargetTestRun(testRunId);
        return role._initFn(testRunProxy);
    }
    async getCtx({ testRunId }) {
        return this._getTargetTestRun(testRunId).ctx;
    }
    async getFixtureCtx({ testRunId }) {
        return this._getTargetTestRun(testRunId).fixtureCtx;
    }
    async setCtx({ testRunId, value }) {
        this._getTargetTestRun(testRunId).ctx = value;
    }
    async setFixtureCtx({ testRunId, value }) {
        this._getTargetTestRun(testRunId).fixtureCtx = value;
    }
    onRoleAppeared(role) {
        if (this.state.roles.has(role.id))
            return;
        this.state.roles.set(role.id, role);
    }
    async updateRoleProperty({ roleId, name, value }) {
        const role = this._getTargetRole(roleId);
        // @ts-ignore
        role[name] = value;
    }
    async executeJsExpression({ expression, testRunId, options }) {
        const testRunProxy = this._getTargetTestRun(testRunId);
        return (0, execute_js_expression_1.executeJsExpression)(expression, testRunProxy, options);
    }
    async executeAsyncJsExpression({ expression, testRunId, callsite }) {
        const testRunProxy = this._getTargetTestRun(testRunId);
        return (0, execute_js_expression_1.executeAsyncJsExpression)(expression, testRunProxy, callsite, async (err) => {
            if (err instanceof test_run_1.UncaughtTestCafeErrorInCustomScript === false)
                return;
            const targetError = err;
            if (!(0, utils_1.shouldRenderHtmlWithoutStack)(targetError))
                return;
            testRunProxy.restoreOriginCallsiteForError(targetError);
            // @ts-ignore
            err.errCallsite = (0, utils_1.renderHtmlWithoutStack)(targetError);
        });
    }
    async executeAssertionFn({ testRunId, commandId }) {
        return this
            ._getTargetTestRun(testRunId)
            .executeAssertionFn(commandId);
    }
    async addUnexpectedError({ type, message }) {
        return this.proxy.call(this.addUnexpectedError, { type, message });
    }
    async checkWindow({ testRunId, commandId, url, title }) {
        try {
            return this
                ._getTargetTestRun(testRunId)
                .checkWindow(commandId, { title, url });
        }
        catch (err) {
            throw new errors_1.SwitchToWindowPredicateError(err.message);
        }
    }
    async removeTestRunFromState({ testRunId }) {
        delete this.state.testRuns[testRunId];
    }
    async removeFixtureCtxsFromState({ fixtureIds }) {
        for (const fixtureId of fixtureIds)
            delete this.state.fixtureCtxs[fixtureId];
    }
    async removeUnitsFromState({ runnableConfigurationId }) {
        const unitIds = this._runnableConfigurationUnitsRelations[runnableConfigurationId];
        for (const unitId of unitIds)
            delete this.state.units[unitId];
        delete this._runnableConfigurationUnitsRelations[runnableConfigurationId];
    }
}
exports.default = new CompilerService();
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zZXJ2aWNlcy9jb21waWxlci9zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsNENBQW9CO0FBQ3BCLDhEQUFzQztBQUN0QyxzRUFBNEM7QUFDNUMsZ0ZBQXVEO0FBRXZELG9FQU95QztBQUV6Qyw2QkFJYztBQUVkLDhDQUE4QztBQUM5QyxzREFBMEQ7QUFFMUQseUNBTW9CO0FBZ0NwQixxRUFBNEM7QUFFNUMsa0dBQStFO0FBRS9FLDZEQU82QjtBQUs3Qiw4RUFBcUQ7QUFDckQsZ0ZBQXFHO0FBRXJHLG9EQUsrQjtBQUUvQiw2RUFBeUg7QUFDekgsa0dBQXdFO0FBQ3hFLDZEQUF3RDtBQUN4RCxnREFBbUU7QUFHbkUsbUNBQThCO0FBRTlCLElBQUEsaUNBQXFCLEdBQUUsQ0FBQztBQUV4QixzRkFBc0Y7QUFDdEYsdUNBQXVDO0FBQ3ZDLE9BQU8sQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0FBc0IzQyxNQUFNLGVBQWU7SUFLakI7UUFDSSxPQUFPLENBQUMsS0FBSyxHQUFHLHVCQUFZLENBQUMsT0FBTyxDQUFDO1FBRXJDLE1BQU0sS0FBSyxHQUFJLFlBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUscUJBQWdCLEVBQUUsQ0FBQyxDQUFDO1FBQ2pFLE1BQU0sTUFBTSxHQUFHLFlBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsc0JBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBRW5FLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxnQkFBUSxDQUFDLElBQUksNEJBQWdCLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxvQkFBZSxDQUFDLENBQUMsQ0FBQztRQUNoRixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUUvQixJQUFJLENBQUMsb0NBQW9D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cyBmcm9tICdmcyc7XG5pbXBvcnQgQ29tcGlsZXIgZnJvbSAnLi4vLi4vY29tcGlsZXInO1xuaW1wb3J0IFRlc3RSdW5Qcm94eSBmcm9tICcuL3Rlc3QtcnVuLXByb3h5JztcbmltcG9ydCBUZXN0Q29udHJvbGxlciBmcm9tICcuLi8uLi9hcGkvdGVzdC1jb250cm9sbGVyJztcblxuaW1wb3J0IHtcbiAgICBmbGF0dGVuIGFzIGZsYXR0ZW5UZXN0U3RydWN0dXJlLFxuICAgIGlzRml4dHVyZSxcbiAgICBpc1Rlc3QsXG4gICAgc2VyaWFsaXplIGFzIHNlcmlhbGl6ZVRlc3RTdHJ1Y3R1cmUsXG4gICAgVW5pdCxcbiAgICBVbml0cyxcbn0gZnJvbSAnLi4vc2VyaWFsaXphdGlvbi90ZXN0LXN0cnVjdHVyZSc7XG5cbmltcG9ydCB7XG4gICAgU0VSVklDRV9JTlBVVF9GRCxcbiAgICBTRVJWSUNFX09VVFBVVF9GRCxcbiAgICBTRVJWSUNFX1NZTkNfRkQsXG59IGZyb20gJy4vaW8nO1xuXG5pbXBvcnQgeyBJUENQcm94eSB9IGZyb20gJy4uL3V0aWxzL2lwYy9wcm94eSc7XG5pbXBvcnQgeyBTZXJ2aWNlVHJhbnNwb3J0IH0gZnJvbSAnLi4vdXRpbHMvaXBjL3RyYW5zcG9ydCc7XG5cbmltcG9ydCB7XG4gICAgQ29tcGlsZXJQcm90b2NvbCxcbiAgICBGdW5jdGlvblByb3BlcnRpZXMsXG4gICAgaXNGaXh0dXJlRnVuY3Rpb25Qcm9wZXJ0eSxcbiAgICBpc1Rlc3RGdW5jdGlvblByb3BlcnR5LFxuICAgIFJ1blRlc3RBcmd1bWVudHMsXG59IGZyb20gJy4vcHJvdG9jb2wnO1xuXG5pbXBvcnQge1xuICAgIEV4ZWN1dGVDb21tYW5kQXJndW1lbnRzLFxuICAgIEV4ZWN1dGVNb2NrUHJlZGljYXRlLFxuICAgIEV4ZWN1dGVSZXF1ZXN0RmlsdGVyUnVsZVByZWRpY2F0ZUFyZ3VtZW50cyxcbiAgICBSZW1vdmVIZWFkZXJPbkNvbmZpZ3VyZVJlc3BvbnNlRXZlbnRBcmd1bWVudHMsXG4gICAgUmVxdWVzdEhvb2tFdmVudEFyZ3VtZW50cyxcbiAgICBSZXF1ZXN0SG9va0xvY2F0b3IsXG4gICAgU2V0Q29uZmlndXJlUmVzcG9uc2VFdmVudE9wdGlvbnNBcmd1bWVudHMsXG4gICAgU2V0SGVhZGVyT25Db25maWd1cmVSZXNwb25zZUV2ZW50QXJndW1lbnRzLFxuICAgIFNldE1vY2tBcmd1bWVudHMsXG4gICAgU2V0T3B0aW9uc0FyZ3VtZW50cyxcbiAgICBBZGRSZXF1ZXN0RXZlbnRMaXN0ZW5lcnNBcmd1bWVudHMsXG4gICAgUmVtb3ZlUmVxdWVzdEV2ZW50TGlzdGVuZXJzQXJndW1lbnRzLFxuICAgIEluaXRpYWxpemVUZXN0UnVuRGF0YUFyZ3VtZW50cyxcbiAgICBUZXN0UnVuTG9jYXRvcixcbiAgICBTZXRDdHhBcmd1bWVudHMsXG4gICAgRXhlY3V0ZVJvbGVJbml0Rm5Bcmd1bWVudHMsXG4gICAgVXBkYXRlUm9sZVByb3BlcnR5QXJndW1lbnRzLFxuICAgIEV4ZWN1dGVKc0V4cHJlc3Npb25Bcmd1bWVudHMsXG4gICAgRXhlY3V0ZUFzeW5jSnNFeHByZXNzaW9uQXJndW1lbnRzLFxuICAgIENvbW1hbmRMb2NhdG9yLFxuICAgIEFkZFVuZXhwZWN0ZWRFcnJvckFyZ3VtZW50cyxcbiAgICBDaGVja1dpbmRvd0FyZ3VtZW50LFxuICAgIFJlbW92ZUZpeHR1cmVDdHhzQXJndW1lbnRzLFxuICAgIFJlbW92ZVVuaXRzRnJvbVN0YXRlQXJndW1lbnRzLFxufSBmcm9tICcuL2ludGVyZmFjZXMnO1xuXG5pbXBvcnQgeyBDb21waWxlckFyZ3VtZW50cyB9IGZyb20gJy4uLy4uL2NvbXBpbGVyL2ludGVyZmFjZXMnO1xuaW1wb3J0IEZpeHR1cmUgZnJvbSAnLi4vLi4vYXBpL3N0cnVjdHVyZS9maXh0dXJlJztcbmltcG9ydCB7IERpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2ludGVyZmFjZXMnO1xuaW1wb3J0IFByb2Nlc3NUaXRsZSBmcm9tICcuLi9wcm9jZXNzLXRpdGxlJztcbmltcG9ydCBUZXN0IGZyb20gJy4uLy4uL2FwaS9zdHJ1Y3R1cmUvdGVzdCc7XG5pbXBvcnQgUmVxdWVzdEhvb2tNZXRob2ROYW1lcyBmcm9tICcuLi8uLi9hcGkvcmVxdWVzdC1ob29rcy9ob29rLW1ldGhvZC1uYW1lcyc7XG5cbmltcG9ydCB7XG4gICAgQ29uZmlndXJlUmVzcG9uc2VFdmVudCxcbiAgICBJbmNvbWluZ01lc3NhZ2VMaWtlSW5pdE9wdGlvbnMsXG4gICAgUmVxdWVzdEV2ZW50LFxuICAgIFJlcXVlc3RGaWx0ZXJSdWxlLFxuICAgIFJlc3BvbnNlTW9jayxcbiAgICByZXNwb25zZU1vY2tTZXRCb2R5TWV0aG9kLFxufSBmcm9tICd0ZXN0Y2FmZS1oYW1tZXJoZWFkJztcblxuaW1wb3J0IFJlcXVlc3RIb29rIGZyb20gJy4uLy4uL2FwaS9yZXF1ZXN0LWhvb2tzL2hvb2snO1xuaW1wb3J0IFJlcXVlc3RNb2NrIGZyb20gJy4uLy4uL2FwaS9yZXF1ZXN0LWhvb2tzL3JlcXVlc3QtbW9jayc7XG5pbXBvcnQgUm9sZSBmcm9tICcuLi8uLi9yb2xlL3JvbGUnO1xuaW1wb3J0IHVzZXJWYXJpYWJsZXMgZnJvbSAnLi4vLi4vYXBpL3VzZXItdmFyaWFibGVzJztcbmltcG9ydCB7IGV4ZWN1dGVKc0V4cHJlc3Npb24sIGV4ZWN1dGVBc3luY0pzRXhwcmVzc2lvbiB9IGZyb20gJy4uLy4uL3Rlc3QtcnVuL2V4ZWN1dGUtanMtZXhwcmVzc2lvbic7XG5cbmltcG9ydCB7XG4gICAgVW5jYXVnaHRFcnJvckluQ3VzdG9tU2NyaXB0LFxuICAgIFVuY2F1Z2h0RXhjZXB0aW9uRXJyb3IsXG4gICAgVW5jYXVnaHRUZXN0Q2FmZUVycm9ySW5DdXN0b21TY3JpcHQsXG4gICAgVW5oYW5kbGVkUHJvbWlzZVJlamVjdGlvbkVycm9yLFxufSBmcm9tICcuLi8uLi9lcnJvcnMvdGVzdC1ydW4nO1xuXG5pbXBvcnQgeyByZW5kZXJIdG1sV2l0aG91dFN0YWNrLCBzaG91bGRSZW5kZXJIdG1sV2l0aG91dFN0YWNrIH0gZnJvbSAnLi4vLi4vZXJyb3JzL3Rlc3QtcnVuL3JlbmRlci1lcnJvci10ZW1wbGF0ZS91dGlscyc7XG5pbXBvcnQgc2V0dXBTb3VyY2VNYXBTdXBwb3J0IGZyb20gJy4uLy4uL3V0aWxzL3NldHVwLXNvdXJjZW1hcC1zdXBwb3J0JztcbmltcG9ydCB7IGZvcm1hdEVycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvaGFuZGxlLWVycm9ycyc7XG5pbXBvcnQgeyBTd2l0Y2hUb1dpbmRvd1ByZWRpY2F0ZUVycm9yIH0gZnJvbSAnLi4vLi4vc2hhcmVkL2Vycm9ycyc7XG5pbXBvcnQgTWVzc2FnZUJ1cyBmcm9tICcuLi8uLi91dGlscy9tZXNzYWdlLWJ1cyc7XG5pbXBvcnQgeyBXYXJuaW5nTG9nTWVzc2FnZSB9IGZyb20gJy4uLy4uL25vdGlmaWNhdGlvbnMvd2FybmluZy1sb2cnO1xuaW1wb3J0IHsgdW5pcSB9IGZyb20gJ2xvZGFzaCc7XG5cbnNldHVwU291cmNlTWFwU3VwcG9ydCgpO1xuXG4vLyBUaGlzIGlzIGhhY2sgZm9yIHN1cHBvcnRpbmcgdGhlICdpbXBvcnQgeyB0IH0gZnJvbSBcInRlc3RjYWZlXCInIGV4cHJlc3Npb24gaW4gdGVzdHMuXG4vLyBJdCBjYXVzZWQgYnkgdXNpbmcgdGhlICdlc20nIG1vZHVsZS5cbnJlcXVpcmUoJy4uLy4uL2FwaS90ZXN0LWNvbnRyb2xsZXIvcHJveHknKTtcblxuaW50ZXJmYWNlIFNlcnZpY2VTdGF0ZSB7XG4gICAgdGVzdFJ1bnM6IHsgW2lkOiBzdHJpbmddOiBUZXN0UnVuUHJveHkgfTtcbiAgICBmaXh0dXJlQ3R4czogeyBbaWQ6IHN0cmluZ106IG9iamVjdCB9O1xuICAgIHVuaXRzOiBVbml0cztcbiAgICBvcHRpb25zOiBEaWN0aW9uYXJ5PE9wdGlvblZhbHVlPjtcbiAgICByb2xlczogTWFwPHN0cmluZywgUm9sZT47XG59XG5cbmludGVyZmFjZSBXcmFwU2V0TW9ja0FyZ3VtZW50cyBleHRlbmRzIFJlcXVlc3RIb29rTG9jYXRvciB7XG4gICAgZXZlbnQ6IFJlcXVlc3RFdmVudDtcbn1cblxuaW50ZXJmYWNlIEluaXRUZXN0UnVuUHJveHlEYXRhIHtcbiAgICB0ZXN0UnVuSWQ6IHN0cmluZztcbiAgICB0ZXN0OiBUZXN0O1xuICAgIGJyb3dzZXI6IEJyb3dzZXI7XG4gICAgYWN0aXZlV2luZG93SWQ6IHN0cmluZyB8IG51bGw7XG4gICAgbWVzc2FnZUJ1cz86IE1lc3NhZ2VCdXM7XG59XG5cbmNsYXNzIENvbXBpbGVyU2VydmljZSBpbXBsZW1lbnRzIENvbXBpbGVyUHJvdG9jb2wge1xuICAgIHByaXZhdGUgcmVhZG9ubHkgcHJveHk6IElQQ1Byb3h5O1xuICAgIHByaXZhdGUgcmVhZG9ubHkgc3RhdGU6IFNlcnZpY2VTdGF0ZTtcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9ydW5uYWJsZUNvbmZpZ3VyYXRpb25Vbml0c1JlbGF0aW9uczogeyBbaWQ6IHN0cmluZ106IHN0cmluZ1tdIH07XG5cbiAgICBwdWJsaWMgY29uc3RydWN0b3IgKCkge1xuICAgICAgICBwcm9jZXNzLnRpdGxlID0gUHJvY2Vzc1RpdGxlLnNlcnZpY2U7XG5cbiAgICAgICAgY29uc3QgaW5wdXQgID0gZnMuY3JlYXRlUmVhZFN0cmVhbSgnJywgeyBmZDogU0VSVklDRV9JTlBVVF9GRCB9KTtcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gZnMuY3JlYXRlV3JpdGVTdHJlYW0oJycsIHsgZmQ6IFNFUlZJQ0VfT1VUUFVUX0ZEIH0pO1xuXG4gICAgICAgIHRoaXMucHJveHkgPSBuZXcgSVBDUHJveHkobmV3IFNlcnZpY2VUcmFuc3BvcnQoaW5wdXQsIG91dHB1dCwgU0VSVklDRV9TWU5DX0ZEKSk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLl9pbml0U3RhdGUoKTtcblxuICAgICAgICB0aGlzLl9ydW5uYWJsZUNvbmZpZ3VyYXRpb25Vbml0c1JlbGF0aW9ucyA9IHt9O1xuXG4gICAgICAgIHRoaXMuX3JlZ2lzdGVyRXJyb3JIYW5kbGVycygpO1xuICAgICAgICB0aGlzLl9zZXR1cFJvdXRlcygpO1xuICAgICAgICB0aGlzLnJlYWR5KCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfaW5pdFN0YXRlICgpOiBTZXJ2aWNlU3RhdGUge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdGVzdFJ1bnM6ICAgIHt9LFxuICAgICAgICAgICAgZml4dHVyZUN0eHM6IHt9LFxuICAgICAgICAgICAgdW5pdHM6ICAgICAgIHt9LFxuICAgICAgICAgICAgb3B0aW9uczogICAgIHt9LFxuICAgICAgICAgICAgcm9sZXM6ICAgICAgIG5ldyBNYXA8c3RyaW5nLCBSb2xlPigpLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgX2hhbmRsZVVuZXhwZWN0ZWRFcnJvciAoRXJyb3JDdG9yOiBGdW5jdGlvbiwgZXJyb3I6IEVycm9yKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBmb3JtYXRFcnJvcihFcnJvckN0b3IsIGVycm9yKTtcbiAgICAgICAgY29uc3QgdHlwZSAgICA9IEVycm9yQ3Rvci5uYW1lO1xuXG4gICAgICAgIGF3YWl0IHRoaXMuYWRkVW5leHBlY3RlZEVycm9yKHsgdHlwZSwgbWVzc2FnZSB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIF9yZWdpc3RlckVycm9ySGFuZGxlcnMgKCk6IHZvaWQge1xuICAgICAgICBwcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBhc3luYyBlID0+IHRoaXMuX2hhbmRsZVVuZXhwZWN0ZWRFcnJvcihVbmhhbmRsZWRQcm9taXNlUmVqZWN0aW9uRXJyb3IsIGUgYXMgRXJyb3IpKTtcbiAgICAgICAgcHJvY2Vzcy5vbigndW5jYXVnaHRFeGNlcHRpb24nLCBhc3luYyBlID0+IHRoaXMuX2hhbmRsZVVuZXhwZWN0ZWRFcnJvcihVbmNhdWdodEV4Y2VwdGlvbkVycm9yLCBlIGFzIEVycm9yKSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfZ2V0Rml4dHVyZUN0eCAodW5pdDogVW5pdCk6IG9iamVjdCB7XG4gICAgICAgIGNvbnN0IGZpeHR1cmVJZCA9IGlzVGVzdCh1bml0KSA/ICh1bml0LmZpeHR1cmUgYXMgRml4dHVyZSkuaWQgOiAodW5pdCBhcyBGaXh0dXJlKS5pZDtcblxuICAgICAgICByZXR1cm4gdGhpcy5zdGF0ZS5maXh0dXJlQ3R4c1tmaXh0dXJlSWRdO1xuICAgIH1cblxuICAgIHByaXZhdGUgX2dldFRlc3RDdHggKHsgdGVzdFJ1bklkIH06IFJ1blRlc3RBcmd1bWVudHMsIHVuaXQ6IFVuaXQpOiBUZXN0UnVuUHJveHkge1xuICAgICAgICBjb25zdCB0ZXN0UnVuUHJveHkgPSB0aGlzLl9nZXRUYXJnZXRUZXN0UnVuKHRlc3RSdW5JZCk7XG5cbiAgICAgICAgdGVzdFJ1blByb3h5LmZpeHR1cmVDdHggPSB0aGlzLl9nZXRGaXh0dXJlQ3R4KHVuaXQpO1xuXG4gICAgICAgIHJldHVybiB0ZXN0UnVuUHJveHk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfZ2V0Q29udGV4dCAoYXJnczogUnVuVGVzdEFyZ3VtZW50cywgdW5pdDogVW5pdCk6IFRlc3RSdW5Qcm94eSB8IHVua25vd24ge1xuICAgICAgICBjb25zdCB7IHRlc3RSdW5JZCB9ID0gYXJncztcblxuICAgICAgICBpZiAodGVzdFJ1bklkKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldFRlc3RDdHgoYXJncywgdW5pdCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldEZpeHR1cmVDdHgodW5pdCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfc2V0dXBSb3V0ZXMgKCk6IHZvaWQge1xuICAgICAgICB0aGlzLnByb3h5LnJlZ2lzdGVyKFtcbiAgICAgICAgICAgIHRoaXMuZ2V0VGVzdHMsXG4gICAgICAgICAgICB0aGlzLnJ1blRlc3RGbixcbiAgICAgICAgICAgIHRoaXMuY2xlYW5VcCxcbiAgICAgICAgICAgIHRoaXMuc2V0VXNlclZhcmlhYmxlcyxcbiAgICAgICAgICAgIHRoaXMuc2V0T3B0aW9ucyxcbiAgICAgICAgICAgIHRoaXMub25SZXF1ZXN0SG9va0V2ZW50LFxuICAgICAgICAgICAgdGhpcy5zZXRNb2NrLFxuICAgICAgICAgICAgdGhpcy5zZXRDb25maWd1cmVSZXNwb25zZUV2ZW50T3B0aW9ucyxcbiAgICAgICAgICAgIHRoaXMuc2V0SGVhZGVyT25Db25maWd1cmVSZXNwb25zZUV2ZW50LFxuICAgICAgICAgICAgdGhpcy5yZW1vdmVIZWFkZXJPbkNvbmZpZ3VyZVJlc3BvbnNlRXZlbnQsXG4gICAgICAgICAgICB0aGlzLmV4ZWN1dGVSZXF1ZXN0RmlsdGVyUnVsZVByZWRpY2F0ZSxcbiAgICAgICAgICAgIHRoaXMuZXhlY3V0ZU1vY2tQcmVkaWNhdGUsXG4gICAgICAgICAgICB0aGlzLmdldFdhcm5pbmdNZXNzYWdlcyxcbiAgICAgICAgICAgIHRoaXMuYWRkUmVxdWVzdEV2ZW50TGlzdGVuZXJzLFxuICAgICAgICAgICAgdGhpcy5yZW1vdmVSZXF1ZXN0RXZlbnRMaXN0ZW5lcnMsXG4gICAgICAgICAgICB0aGlzLmluaXRpYWxpemVUZXN0UnVuRGF0YSxcbiAgICAgICAgICAgIHRoaXMuZ2V0QXNzZXJ0aW9uQWN0dWFsVmFsdWUsXG4gICAgICAgICAgICB0aGlzLmV4ZWN1dGVSb2xlSW5pdEZuLFxuICAgICAgICAgICAgdGhpcy5nZXRDdHgsXG4gICAgICAgICAgICB0aGlzLmdldEZpeHR1cmVDdHgsXG4gICAgICAgICAgICB0aGlzLnNldEN0eCxcbiAgICAgICAgICAgIHRoaXMuc2V0Rml4dHVyZUN0eCxcbiAgICAgICAgICAgIHRoaXMudXBkYXRlUm9sZVByb3BlcnR5LFxuICAgICAgICAgICAgdGhpcy5leGVjdXRlSnNFeHByZXNzaW9uLFxuICAgICAgICAgICAgdGhpcy5leGVjdXRlQXN5bmNKc0V4cHJlc3Npb24sXG4gICAgICAgICAgICB0aGlzLmFkZFVuZXhwZWN0ZWRFcnJvcixcbiAgICAgICAgICAgIHRoaXMuY2hlY2tXaW5kb3csXG4gICAgICAgICAgICB0aGlzLnJlbW92ZVRlc3RSdW5Gcm9tU3RhdGUsXG4gICAgICAgICAgICB0aGlzLnJlbW92ZUZpeHR1cmVDdHhzRnJvbVN0YXRlLFxuICAgICAgICAgICAgdGhpcy5yZW1vdmVVbml0c0Zyb21TdGF0ZSxcbiAgICAgICAgXSwgdGhpcyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfZ2V0RnVuY3Rpb24gKHVuaXQ6IFVuaXQsIGZ1bmN0aW9uTmFtZTogRnVuY3Rpb25Qcm9wZXJ0aWVzKTogRnVuY3Rpb258bnVsbCB7XG4gICAgICAgIGlmIChpc1Rlc3QodW5pdCkgJiYgaXNUZXN0RnVuY3Rpb25Qcm9wZXJ0eShmdW5jdGlvbk5hbWUpKVxuICAgICAgICAgICAgcmV0dXJuIHVuaXRbZnVuY3Rpb25OYW1lXTtcblxuICAgICAgICBpZiAoaXNGaXh0dXJlKHVuaXQpICYmIGlzRml4dHVyZUZ1bmN0aW9uUHJvcGVydHkoZnVuY3Rpb25OYW1lKSlcbiAgICAgICAgICAgIHJldHVybiB1bml0W2Z1bmN0aW9uTmFtZV07XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgZmluZCAnJHtmdW5jdGlvbk5hbWV9JyBmdW5jdGlvbiBmb3IgJHt0eXBlb2YgdW5pdH1gKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIF93cmFwRXZlbnRNZXRob2RzICh7IG5hbWUsIHRlc3RJZCwgaG9va0lkLCBldmVudERhdGEgfTogUmVxdWVzdEhvb2tFdmVudEFyZ3VtZW50cyk6IHZvaWQge1xuICAgICAgICBpZiAobmFtZSA9PT0gUmVxdWVzdEhvb2tNZXRob2ROYW1lcy5vblJlcXVlc3QpXG4gICAgICAgICAgICB0aGlzLl93cmFwU2V0TW9ja0ZuKHsgdGVzdElkLCBob29rSWQsIGV2ZW50OiBldmVudERhdGEgYXMgUmVxdWVzdEV2ZW50IH0pO1xuICAgICAgICBlbHNlIGlmIChuYW1lID09PSBSZXF1ZXN0SG9va01ldGhvZE5hbWVzLl9vbkNvbmZpZ3VyZVJlc3BvbnNlKVxuICAgICAgICAgICAgdGhpcy5fd3JhcENvbmZpZ3VyZVJlc3BvbnNlRXZlbnRNZXRob2RzKGV2ZW50RGF0YSBhcyBDb25maWd1cmVSZXNwb25zZUV2ZW50KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIF93cmFwU2V0TW9ja0ZuICh7IHRlc3RJZCwgaG9va0lkLCBldmVudCB9OiBXcmFwU2V0TW9ja0FyZ3VtZW50cyk6IHZvaWQge1xuICAgICAgICBldmVudC5zZXRNb2NrID0gYXN5bmMgKG1vY2s6IFJlc3BvbnNlTW9jaykgPT4ge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXRNb2NrKHtcbiAgICAgICAgICAgICAgICByZXNwb25zZUV2ZW50SWQ6IGV2ZW50LmlkLFxuICAgICAgICAgICAgICAgIHJ1bGVJZDogICAgICAgICAgZXZlbnQucmVxdWVzdEZpbHRlclJ1bGUuaWQsXG4gICAgICAgICAgICAgICAgdGVzdElkLFxuICAgICAgICAgICAgICAgIGhvb2tJZCxcbiAgICAgICAgICAgICAgICBtb2NrLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfd3JhcENvbmZpZ3VyZVJlc3BvbnNlRXZlbnRNZXRob2RzIChldmVudDogQ29uZmlndXJlUmVzcG9uc2VFdmVudCk6IHZvaWQge1xuICAgICAgICBldmVudC5zZXRIZWFkZXIgPSBhc3luYyAobmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNldEhlYWRlck9uQ29uZmlndXJlUmVzcG9uc2VFdmVudCh7XG4gICAgICAgICAgICAgICAgZXZlbnRJZDogICAgIGV2ZW50LmlkLFxuICAgICAgICAgICAgICAgIGhlYWRlck5hbWU6ICBuYW1lLFxuICAgICAgICAgICAgICAgIGhlYWRlclZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIGV2ZW50LnJlbW92ZUhlYWRlciA9IGFzeW5jIChuYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVtb3ZlSGVhZGVyT25Db25maWd1cmVSZXNwb25zZUV2ZW50KHtcbiAgICAgICAgICAgICAgICBldmVudElkOiAgICBldmVudC5pZCxcbiAgICAgICAgICAgICAgICBoZWFkZXJOYW1lOiBuYW1lLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfaW5pdGlhbGl6ZVRlc3RSdW5Qcm94eSAoeyB0ZXN0UnVuSWQsIHRlc3QsIGJyb3dzZXIsIGFjdGl2ZVdpbmRvd0lkLCBtZXNzYWdlQnVzIH06IEluaXRUZXN0UnVuUHJveHlEYXRhKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHRlc3RSdW5Qcm94eSA9IG5ldyBUZXN0UnVuUHJveHkoe1xuICAgICAgICAgICAgZGlzcGF0Y2hlcjogdGhpcyxcbiAgICAgICAgICAgIGlkOiAgICAgICAgIHRlc3RSdW5JZCxcbiAgICAgICAgICAgIG9wdGlvbnM6ICAgIHRoaXMuc3RhdGUub3B0aW9ucyxcbiAgICAgICAgICAgIHRlc3QsXG4gICAgICAgICAgICBicm93c2VyLFxuICAgICAgICAgICAgYWN0aXZlV2luZG93SWQsXG4gICAgICAgICAgICBtZXNzYWdlQnVzLFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnN0YXRlLnRlc3RSdW5zW3Rlc3RSdW5JZF0gPSB0ZXN0UnVuUHJveHk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfaW5pdGlhbGl6ZUZpeHR1cmVDdHggKHRlc3Q6IFRlc3QpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgZml4dHVyZUlkID0gKHRlc3QuZml4dHVyZSBhcyBGaXh0dXJlKS5pZDtcblxuICAgICAgICBpZiAodGhpcy5zdGF0ZS5maXh0dXJlQ3R4c1tmaXh0dXJlSWRdKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuc3RhdGUuZml4dHVyZUN0eHNbZml4dHVyZUlkXSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfZ2V0VGFyZ2V0VGVzdFJ1biAodGVzdFJ1bklkOiBzdHJpbmcpOiBUZXN0UnVuUHJveHkge1xuICAgICAgICByZXR1cm4gdGhpcy5zdGF0ZS50ZXN0UnVuc1t0ZXN0UnVuSWRdO1xuICAgIH1cblxuICAgIHByaXZhdGUgX2dldFRhcmdldFJvbGUgKHJvbGVJZDogc3RyaW5nKTogUm9sZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YXRlLnJvbGVzLmdldChyb2xlSWQpIGFzIFJvbGU7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNldFVzZXJWYXJpYWJsZXMgKHZhbHVlOiBVc2VyVmFyaWFibGVzIHwgbnVsbCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICB1c2VyVmFyaWFibGVzLnZhbHVlID0gdmFsdWU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfZ2V0VW5pdElkcyAodGVzdHM6IFRlc3RbXSk6IHN0cmluZ1tdIHtcbiAgICAgICAgY29uc3QgdGVzdElkcyAgICAgPSB0ZXN0cy5tYXAodGVzdCA9PiB0ZXN0LmlkKTtcbiAgICAgICAgY29uc3QgZml4dHVyZUlkcyAgPSB0ZXN0cy5tYXAodGVzdCA9PiB0ZXN0LmZpeHR1cmU/LmlkKSBhcyBzdHJpbmdbXTtcbiAgICAgICAgY29uc3QgdGVzdEZpbGVJZHMgPSB0ZXN0cy5tYXAodGVzdCA9PiB0ZXN0LnRlc3RGaWxlLmlkKTtcblxuICAgICAgICByZXR1cm4gdW5pcShbLi4udGVzdElkcywgLi4uZml4dHVyZUlkcywgLi4udGVzdEZpbGVJZHNdKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc2V0T3B0aW9ucyAoeyB2YWx1ZSB9OiBTZXRPcHRpb25zQXJndW1lbnRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRoaXMuc3RhdGUub3B0aW9ucyA9IHZhbHVlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyByZWFkeSAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRoaXMucHJveHkuY2FsbCh0aGlzLnJlYWR5KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgY2xlYW5VcCAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGF3YWl0IENvbXBpbGVyLmNsZWFuVXAoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0VGVzdHMgKHsgc291cmNlTGlzdCwgY29tcGlsZXJPcHRpb25zLCBydW5uYWJsZUNvbmZpZ3VyYXRpb25JZCB9OiBDb21waWxlckFyZ3VtZW50cywgYmFzZVVybD86IHN0cmluZyk6IFByb21pc2U8VW5pdHM+IHtcbiAgICAgICAgY29uc3QgY29tcGlsZXIgPSBuZXcgQ29tcGlsZXIoc291cmNlTGlzdCwgY29tcGlsZXJPcHRpb25zLCB7IGlzQ29tcGlsZXJTZXJ2aWNlTW9kZTogdHJ1ZSwgYmFzZVVybCB9KTtcblxuICAgICAgICBjb25zdCB0ZXN0cyAgID0gYXdhaXQgY29tcGlsZXIuZ2V0VGVzdHMoKTtcbiAgICAgICAgY29uc3QgdW5pdHMgICA9IGZsYXR0ZW5UZXN0U3RydWN0dXJlKHRlc3RzKTtcbiAgICAgICAgY29uc3QgdW5pdElkcyA9IHRoaXMuX2dldFVuaXRJZHModGVzdHMpO1xuXG4gICAgICAgIHRoaXMuX3J1bm5hYmxlQ29uZmlndXJhdGlvblVuaXRzUmVsYXRpb25zW3J1bm5hYmxlQ29uZmlndXJhdGlvbklkXSA9IHVuaXRJZHM7XG5cbiAgICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0YXRlLnVuaXRzLCB1bml0cyk7XG5cbiAgICAgICAgcmV0dXJuIHNlcmlhbGl6ZVRlc3RTdHJ1Y3R1cmUodW5pdHMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBydW5UZXN0Rm4gKGFyZ3M6IFJ1blRlc3RBcmd1bWVudHMpOiBQcm9taXNlPHVua25vd24+IHtcbiAgICAgICAgY29uc3QgeyBpZCwgZnVuY3Rpb25OYW1lIH0gPSBhcmdzO1xuXG4gICAgICAgIGNvbnN0IHVuaXQgICAgICAgICAgID0gdGhpcy5zdGF0ZS51bml0c1tpZF07XG4gICAgICAgIGNvbnN0IGNvbnRleHQgICAgICAgID0gdGhpcy5fZ2V0Q29udGV4dChhcmdzLCB1bml0KTtcbiAgICAgICAgY29uc3QgZnVuY3Rpb25PYmplY3QgPSB0aGlzLl9nZXRGdW5jdGlvbih1bml0LCBmdW5jdGlvbk5hbWUpO1xuXG4gICAgICAgIGlmICghZnVuY3Rpb25PYmplY3QpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBmaW5kIHRoZSBcIiR7ZnVuY3Rpb25OYW1lfVwiIG9mICR7dHlwZW9mIHVuaXR9YCk7XG5cbiAgICAgICAgcmV0dXJuIGF3YWl0IGZ1bmN0aW9uT2JqZWN0KGNvbnRleHQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBleGVjdXRlQ29tbWFuZFN5bmMgKHsgaWQsIGNvbW1hbmQsIGNhbGxzaXRlIH06IEV4ZWN1dGVDb21tYW5kQXJndW1lbnRzKTogdW5rbm93biB7XG4gICAgICAgIHJldHVybiB0aGlzLnByb3h5LmNhbGxTeW5jKHRoaXMuZXhlY3V0ZUNvbW1hbmQsIHsgaWQsIGNvbW1hbmQsIGNhbGxzaXRlIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBleGVjdXRlQ29tbWFuZCAoeyBjb21tYW5kLCBpZCwgY2FsbHNpdGUgfTogRXhlY3V0ZUNvbW1hbmRBcmd1bWVudHMpOiBQcm9taXNlPHVua25vd24+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJveHkuY2FsbCh0aGlzLmV4ZWN1dGVDb21tYW5kLCB7IGlkLCBjb21tYW5kLCBjYWxsc2l0ZSB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgb25SZXF1ZXN0SG9va0V2ZW50ICh7IG5hbWUsIHRlc3RJZCwgaG9va0lkLCBldmVudERhdGEgfTogUmVxdWVzdEhvb2tFdmVudEFyZ3VtZW50cyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICB0aGlzLl93cmFwRXZlbnRNZXRob2RzKHsgbmFtZSwgdGVzdElkLCBob29rSWQsIGV2ZW50RGF0YSB9KTtcblxuICAgICAgICBjb25zdCB0ZXN0ICAgICAgID0gdGhpcy5zdGF0ZS51bml0c1t0ZXN0SWRdIGFzIFRlc3Q7XG4gICAgICAgIGNvbnN0IHRhcmdldEhvb2sgPSB0ZXN0LnJlcXVlc3RIb29rcy5maW5kKGhvb2sgPT4gaG9vay5pZCA9PT0gaG9va0lkKSBhcyBSZXF1ZXN0SG9vaztcblxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGF3YWl0IHRhcmdldEhvb2tbbmFtZV0uY2FsbCh0YXJnZXRIb29rLCBldmVudERhdGEpO1xuXG4gICAgICAgIGlmIChuYW1lID09PSBSZXF1ZXN0SG9va01ldGhvZE5hbWVzLl9vbkNvbmZpZ3VyZVJlc3BvbnNlICYmIHRhcmdldEhvb2suX3Jlc3BvbnNlRXZlbnRDb25maWd1cmVPcHRzKSB7XG4gICAgICAgICAgICBjb25zdCB7IG9wdHMsIGlkOiBldmVudElkIH0gPSBldmVudERhdGEgYXMgQ29uZmlndXJlUmVzcG9uc2VFdmVudDtcblxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXRDb25maWd1cmVSZXNwb25zZUV2ZW50T3B0aW9ucyh7IGV2ZW50SWQsIG9wdHMgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc2V0TW9jayAoeyB0ZXN0SWQsIGhvb2tJZCwgcnVsZUlkLCByZXNwb25zZUV2ZW50SWQsIG1vY2sgfTogU2V0TW9ja0FyZ3VtZW50cyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBhd2FpdCB0aGlzLnByb3h5LmNhbGwodGhpcy5zZXRNb2NrLCB7IHRlc3RJZCwgaG9va0lkLCBydWxlSWQsIHJlc3BvbnNlRXZlbnRJZCwgbW9jayB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc2V0Q29uZmlndXJlUmVzcG9uc2VFdmVudE9wdGlvbnMgKHsgZXZlbnRJZCwgb3B0cyB9OiBTZXRDb25maWd1cmVSZXNwb25zZUV2ZW50T3B0aW9uc0FyZ3VtZW50cyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBhd2FpdCB0aGlzLnByb3h5LmNhbGwodGhpcy5zZXRDb25maWd1cmVSZXNwb25zZUV2ZW50T3B0aW9ucywgeyBldmVudElkLCBvcHRzIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzZXRIZWFkZXJPbkNvbmZpZ3VyZVJlc3BvbnNlRXZlbnQgKHsgZXZlbnRJZCwgaGVhZGVyTmFtZSwgaGVhZGVyVmFsdWUgfTogU2V0SGVhZGVyT25Db25maWd1cmVSZXNwb25zZUV2ZW50QXJndW1lbnRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGF3YWl0IHRoaXMucHJveHkuY2FsbCh0aGlzLnNldEhlYWRlck9uQ29uZmlndXJlUmVzcG9uc2VFdmVudCwgeyBldmVudElkLCBoZWFkZXJOYW1lLCBoZWFkZXJWYWx1ZSB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgcmVtb3ZlSGVhZGVyT25Db25maWd1cmVSZXNwb25zZUV2ZW50ICh7IGV2ZW50SWQsIGhlYWRlck5hbWUgfTogUmVtb3ZlSGVhZGVyT25Db25maWd1cmVSZXNwb25zZUV2ZW50QXJndW1lbnRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGF3YWl0IHRoaXMucHJveHkuY2FsbCh0aGlzLnJlbW92ZUhlYWRlck9uQ29uZmlndXJlUmVzcG9uc2VFdmVudCwgeyBldmVudElkLCBoZWFkZXJOYW1lIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBleGVjdXRlUmVxdWVzdEZpbHRlclJ1bGVQcmVkaWNhdGUgKHsgdGVzdElkLCBob29rSWQsIHJ1bGVJZCwgcmVxdWVzdEluZm8gfTogRXhlY3V0ZVJlcXVlc3RGaWx0ZXJSdWxlUHJlZGljYXRlQXJndW1lbnRzKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIGNvbnN0IHRlc3QgICAgICAgPSB0aGlzLnN0YXRlLnVuaXRzW3Rlc3RJZF0gYXMgVGVzdDtcbiAgICAgICAgY29uc3QgdGFyZ2V0SG9vayA9IHRlc3QucmVxdWVzdEhvb2tzLmZpbmQoaG9vayA9PiBob29rLmlkID09PSBob29rSWQpIGFzIFJlcXVlc3RIb29rO1xuICAgICAgICBjb25zdCB0YXJnZXRSdWxlID0gdGFyZ2V0SG9vay5fcmVxdWVzdEZpbHRlclJ1bGVzLmZpbmQocnVsZSA9PiBydWxlLmlkID09PSBydWxlSWQpIGFzIFJlcXVlc3RGaWx0ZXJSdWxlO1xuICAgICAgICBjb25zdCByZXN1bHQgICAgID0gYXdhaXQgdGFyZ2V0UnVsZS5vcHRpb25zLmNhbGwodGFyZ2V0UnVsZSwgcmVxdWVzdEluZm8pO1xuXG4gICAgICAgIHJldHVybiAhIXJlc3VsdDtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZXhlY3V0ZU1vY2tQcmVkaWNhdGUgKHsgdGVzdElkLCBob29rSWQsIHJ1bGVJZCwgcmVxdWVzdEluZm8sIHJlcyB9OiBFeGVjdXRlTW9ja1ByZWRpY2F0ZSk6IFByb21pc2U8SW5jb21pbmdNZXNzYWdlTGlrZUluaXRPcHRpb25zPiB7XG4gICAgICAgIGNvbnN0IHRlc3QgICAgICAgICA9IHRoaXMuc3RhdGUudW5pdHNbdGVzdElkXSBhcyBUZXN0O1xuICAgICAgICBjb25zdCByZXF1ZXN0TW9jayAgPSB0ZXN0LnJlcXVlc3RIb29rcy5maW5kKGhvb2sgPT4gaG9vay5pZCA9PT0gaG9va0lkKSBhcyBSZXF1ZXN0TW9jaztcbiAgICAgICAgY29uc3QgcmVzcG9uc2VNb2NrID0gcmVxdWVzdE1vY2subW9ja3MuZ2V0KHJ1bGVJZCkgYXMgUmVzcG9uc2VNb2NrO1xuXG4gICAgICAgIHJlc3BvbnNlTW9ja1NldEJvZHlNZXRob2QuYWRkKHJlcyk7XG5cbiAgICAgICAgcmVzID0gT2JqZWN0LmFzc2lnbihyZXMsIGF3YWl0IChyZXNwb25zZU1vY2suYm9keSBhcyBGdW5jdGlvbikocmVxdWVzdEluZm8sIHJlcykpO1xuXG4gICAgICAgIHJlc3BvbnNlTW9ja1NldEJvZHlNZXRob2QucmVtb3ZlKHJlcyk7XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0V2FybmluZ01lc3NhZ2VzICh7IHRlc3RSdW5JZCB9OiBUZXN0UnVuTG9jYXRvcik6IFByb21pc2U8V2FybmluZ0xvZ01lc3NhZ2VbXT4ge1xuICAgICAgICAvLyBOT1RFOiBJbiBjYXNlIG9mIHJhaXNpbmcgYW4gZXJyb3IgaW50byBSZXBvcnRlclBsdWdpbkhvc3QgbWV0aG9kcyxcbiAgICAgICAgLy8gVGVzdFJ1biBoYXMgdGltZSB0byBzdGFydC5cbiAgICAgICAgY29uc3QgdGFyZ2V0VGVzdFJ1biA9IHRoaXMuX2dldFRhcmdldFRlc3RSdW4odGVzdFJ1bklkKTtcblxuICAgICAgICByZXR1cm4gdGFyZ2V0VGVzdFJ1biA/IHRhcmdldFRlc3RSdW4ud2FybmluZ0xvZy5tZXNzYWdlSW5mb3MgOiBbXTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgYWRkUmVxdWVzdEV2ZW50TGlzdGVuZXJzICggeyBob29rSWQsIGhvb2tDbGFzc05hbWUsIHJ1bGVzIH06IEFkZFJlcXVlc3RFdmVudExpc3RlbmVyc0FyZ3VtZW50cyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5wcm94eS5jYWxsKHRoaXMuYWRkUmVxdWVzdEV2ZW50TGlzdGVuZXJzLCB7IGhvb2tJZCwgaG9va0NsYXNzTmFtZSwgcnVsZXMgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHJlbW92ZVJlcXVlc3RFdmVudExpc3RlbmVycyAoeyBydWxlcyB9OiBSZW1vdmVSZXF1ZXN0RXZlbnRMaXN0ZW5lcnNBcmd1bWVudHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucHJveHkuY2FsbCh0aGlzLnJlbW92ZVJlcXVlc3RFdmVudExpc3RlbmVycywgeyBydWxlcyB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgaW5pdGlhbGl6ZVRlc3RSdW5EYXRhICh7IHRlc3RSdW5JZCwgdGVzdElkLCBicm93c2VyLCBhY3RpdmVXaW5kb3dJZCwgbWVzc2FnZUJ1cyB9OiBJbml0aWFsaXplVGVzdFJ1bkRhdGFBcmd1bWVudHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gTk9URTogSW4gY2FzZSBvZiByYWlzaW5nIGFuIGVycm9yIGludG8gUmVwb3J0ZXJQbHVnaW5Ib3N0IG1ldGhvZHMsXG4gICAgICAgIC8vIFRlc3RSdW4gaGFzIHRpbWUgdG8gc3RhcnQuXG4gICAgICAgIGNvbnN0IHRlc3QgPSB0aGlzLnN0YXRlLnVuaXRzW3Rlc3RJZF0gYXMgVGVzdDtcblxuICAgICAgICBpZiAoIXRlc3QpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5faW5pdGlhbGl6ZVRlc3RSdW5Qcm94eSh7IHRlc3RSdW5JZCwgdGVzdCwgYnJvd3NlciwgYWN0aXZlV2luZG93SWQsIG1lc3NhZ2VCdXMgfSk7XG4gICAgICAgIHRoaXMuX2luaXRpYWxpemVGaXh0dXJlQ3R4KHRlc3QpO1xuICAgIH1cblxuICAgIHB1YmxpYyBlbmFibGVEZWJ1Z0Zvck5vbkRlYnVnQ29tbWFuZHMgKCk6IHZvaWQge1xuICAgICAgICBUZXN0Q29udHJvbGxlci5lbmFibGVEZWJ1Z0Zvck5vbkRlYnVnQ29tbWFuZHMoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZGlzYWJsZURlYnVnRm9yTm9uRGVidWdDb21tYW5kcyAoKTogdm9pZCB7XG4gICAgICAgIFRlc3RDb250cm9sbGVyLmRpc2FibGVEZWJ1Z0Zvck5vbkRlYnVnQ29tbWFuZHMoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0QXNzZXJ0aW9uQWN0dWFsVmFsdWUgKHsgdGVzdFJ1bklkLCBjb21tYW5kSWQgfTogQ29tbWFuZExvY2F0b3IpOiBQcm9taXNlPHVua25vd24+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFRhcmdldFRlc3RSdW4odGVzdFJ1bklkKS5nZXRBc3NlcnRpb25BY3R1YWxWYWx1ZShjb21tYW5kSWQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBleGVjdXRlUm9sZUluaXRGbiAoeyB0ZXN0UnVuSWQsIHJvbGVJZCB9OiBFeGVjdXRlUm9sZUluaXRGbkFyZ3VtZW50cyk6IFByb21pc2U8dW5rbm93bj4ge1xuICAgICAgICBjb25zdCByb2xlICAgICAgICAgPSB0aGlzLl9nZXRUYXJnZXRSb2xlKHJvbGVJZCk7XG4gICAgICAgIGNvbnN0IHRlc3RSdW5Qcm94eSA9IHRoaXMuX2dldFRhcmdldFRlc3RSdW4odGVzdFJ1bklkKTtcblxuICAgICAgICByZXR1cm4gKHJvbGUuX2luaXRGbiBhcyBGdW5jdGlvbikodGVzdFJ1blByb3h5KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0Q3R4ICh7IHRlc3RSdW5JZCB9OiBUZXN0UnVuTG9jYXRvcik6IFByb21pc2U8b2JqZWN0PiB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRUYXJnZXRUZXN0UnVuKHRlc3RSdW5JZCkuY3R4O1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRGaXh0dXJlQ3R4ICh7IHRlc3RSdW5JZCB9OiBUZXN0UnVuTG9jYXRvcik6IFByb21pc2U8b2JqZWN0PiB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRUYXJnZXRUZXN0UnVuKHRlc3RSdW5JZCkuZml4dHVyZUN0eDtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc2V0Q3R4ICh7IHRlc3RSdW5JZCwgdmFsdWUgfTogU2V0Q3R4QXJndW1lbnRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRoaXMuX2dldFRhcmdldFRlc3RSdW4odGVzdFJ1bklkKS5jdHggPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc2V0Rml4dHVyZUN0eCAoeyB0ZXN0UnVuSWQsIHZhbHVlIH06IFNldEN0eEFyZ3VtZW50cyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICB0aGlzLl9nZXRUYXJnZXRUZXN0UnVuKHRlc3RSdW5JZCkuZml4dHVyZUN0eCA9IHZhbHVlO1xuICAgIH1cblxuICAgIHB1YmxpYyBvblJvbGVBcHBlYXJlZCAocm9sZTogUm9sZSk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5zdGF0ZS5yb2xlcy5oYXMocm9sZS5pZCkpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5zdGF0ZS5yb2xlcy5zZXQocm9sZS5pZCwgcm9sZSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHVwZGF0ZVJvbGVQcm9wZXJ0eSAoeyByb2xlSWQsIG5hbWUsIHZhbHVlIH06IFVwZGF0ZVJvbGVQcm9wZXJ0eUFyZ3VtZW50cyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCByb2xlID0gdGhpcy5fZ2V0VGFyZ2V0Um9sZShyb2xlSWQpO1xuXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgcm9sZVtuYW1lXSA9IHZhbHVlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBleGVjdXRlSnNFeHByZXNzaW9uICh7IGV4cHJlc3Npb24sIHRlc3RSdW5JZCwgb3B0aW9ucyB9OiBFeGVjdXRlSnNFeHByZXNzaW9uQXJndW1lbnRzKTogUHJvbWlzZTx1bmtub3duPiB7XG4gICAgICAgIGNvbnN0IHRlc3RSdW5Qcm94eSA9IHRoaXMuX2dldFRhcmdldFRlc3RSdW4odGVzdFJ1bklkKTtcblxuICAgICAgICByZXR1cm4gZXhlY3V0ZUpzRXhwcmVzc2lvbihleHByZXNzaW9uLCB0ZXN0UnVuUHJveHksIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBleGVjdXRlQXN5bmNKc0V4cHJlc3Npb24gKHsgZXhwcmVzc2lvbiwgdGVzdFJ1bklkLCBjYWxsc2l0ZSB9OiBFeGVjdXRlQXN5bmNKc0V4cHJlc3Npb25Bcmd1bWVudHMpOiBQcm9taXNlPHVua25vd24+IHtcbiAgICAgICAgY29uc3QgdGVzdFJ1blByb3h5ID0gdGhpcy5fZ2V0VGFyZ2V0VGVzdFJ1bih0ZXN0UnVuSWQpO1xuXG4gICAgICAgIHJldHVybiBleGVjdXRlQXN5bmNKc0V4cHJlc3Npb24oZXhwcmVzc2lvbiwgdGVzdFJ1blByb3h5LCBjYWxsc2l0ZSwgYXN5bmMgKGVycjogVW5jYXVnaHRUZXN0Q2FmZUVycm9ySW5DdXN0b21TY3JpcHQgfCBVbmNhdWdodEVycm9ySW5DdXN0b21TY3JpcHQpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBVbmNhdWdodFRlc3RDYWZlRXJyb3JJbkN1c3RvbVNjcmlwdCA9PT0gZmFsc2UpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCB0YXJnZXRFcnJvciA9IGVyciBhcyBVbmNhdWdodFRlc3RDYWZlRXJyb3JJbkN1c3RvbVNjcmlwdDtcblxuICAgICAgICAgICAgaWYgKCFzaG91bGRSZW5kZXJIdG1sV2l0aG91dFN0YWNrKHRhcmdldEVycm9yKSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIHRlc3RSdW5Qcm94eS5yZXN0b3JlT3JpZ2luQ2FsbHNpdGVGb3JFcnJvcih0YXJnZXRFcnJvcik7XG5cbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGVyci5lcnJDYWxsc2l0ZSA9IHJlbmRlckh0bWxXaXRob3V0U3RhY2sodGFyZ2V0RXJyb3IpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZXhlY3V0ZUFzc2VydGlvbkZuICh7IHRlc3RSdW5JZCwgY29tbWFuZElkIH06IENvbW1hbmRMb2NhdG9yKTogUHJvbWlzZTx1bmtub3duPiB7XG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgICAgICAgICAuX2dldFRhcmdldFRlc3RSdW4odGVzdFJ1bklkKVxuICAgICAgICAgICAgLmV4ZWN1dGVBc3NlcnRpb25Gbihjb21tYW5kSWQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBhZGRVbmV4cGVjdGVkRXJyb3IgKHsgdHlwZSwgbWVzc2FnZSB9OiBBZGRVbmV4cGVjdGVkRXJyb3JBcmd1bWVudHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJveHkuY2FsbCh0aGlzLmFkZFVuZXhwZWN0ZWRFcnJvciwgeyB0eXBlLCBtZXNzYWdlIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBjaGVja1dpbmRvdyAoeyB0ZXN0UnVuSWQsIGNvbW1hbmRJZCwgdXJsLCB0aXRsZSB9OiBDaGVja1dpbmRvd0FyZ3VtZW50KTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpc1xuICAgICAgICAgICAgICAgIC5fZ2V0VGFyZ2V0VGVzdFJ1bih0ZXN0UnVuSWQpXG4gICAgICAgICAgICAgICAgLmNoZWNrV2luZG93KGNvbW1hbmRJZCwgeyB0aXRsZSwgdXJsIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFN3aXRjaFRvV2luZG93UHJlZGljYXRlRXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHJlbW92ZVRlc3RSdW5Gcm9tU3RhdGUgKHsgdGVzdFJ1bklkIH06IFRlc3RSdW5Mb2NhdG9yKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0YXRlLnRlc3RSdW5zW3Rlc3RSdW5JZF07XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHJlbW92ZUZpeHR1cmVDdHhzRnJvbVN0YXRlICh7IGZpeHR1cmVJZHMgfTogUmVtb3ZlRml4dHVyZUN0eHNBcmd1bWVudHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgZm9yIChjb25zdCBmaXh0dXJlSWQgb2YgZml4dHVyZUlkcylcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnN0YXRlLmZpeHR1cmVDdHhzW2ZpeHR1cmVJZF07XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHJlbW92ZVVuaXRzRnJvbVN0YXRlICh7IHJ1bm5hYmxlQ29uZmlndXJhdGlvbklkIH06IFJlbW92ZVVuaXRzRnJvbVN0YXRlQXJndW1lbnRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IHVuaXRJZHMgPSB0aGlzLl9ydW5uYWJsZUNvbmZpZ3VyYXRpb25Vbml0c1JlbGF0aW9uc1tydW5uYWJsZUNvbmZpZ3VyYXRpb25JZF07XG5cbiAgICAgICAgZm9yIChjb25zdCB1bml0SWQgb2YgdW5pdElkcylcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnN0YXRlLnVuaXRzW3VuaXRJZF07XG5cbiAgICAgICAgZGVsZXRlIHRoaXMuX3J1bm5hYmxlQ29uZmlndXJhdGlvblVuaXRzUmVsYXRpb25zW3J1bm5hYmxlQ29uZmlndXJhdGlvbklkXTtcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBDb21waWxlclNlcnZpY2UoKTtcbiJdfQ==