"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const chrome_remote_interface_1 = __importDefault(require("chrome-remote-interface"));
const child_process_1 = require("child_process");
const endpoint_utils_1 = require("endpoint-utils");
const io_1 = require("./io");
const test_structure_1 = require("../serialization/test-structure");
const prepare_options_1 = __importDefault(require("../serialization/prepare-options"));
const test_run_tracker_1 = __importDefault(require("../../api/test-run-tracker"));
const test_controller_1 = __importDefault(require("../../api/test-controller"));
const proxy_1 = require("../utils/ipc/proxy");
const transport_1 = require("../utils/ipc/transport");
const async_event_emitter_1 = __importDefault(require("../../utils/async-event-emitter"));
const error_list_1 = __importDefault(require("../../errors/error-list"));
const debug_action_1 = __importDefault(require("../../utils/debug-action"));
const observation_1 = require("../../test-run/commands/observation");
const method_should_not_be_called_error_1 = __importDefault(require("../utils/method-should-not-be-called-error"));
const test_run_1 = require("../../errors/test-run");
const handle_errors_1 = require("../../utils/handle-errors");
const node_arguments_filter_1 = require("../../cli/node-arguments-filter");
const SERVICE_PATH = require.resolve('./service-loader');
const INTERNAL_FILES_URL = (0, url_1.pathToFileURL)(path_1.default.join(__dirname, '../../'));
const INSPECT_RE = new RegExp(`^(${node_arguments_filter_1.V8_DEBUG_FLAGS.join('|')})`);
const INSPECT_PORT_RE = new RegExp(`^(${node_arguments_filter_1.V8_DEBUG_FLAGS.join('|')})=(.+:)?(\\d+)$`);
const INITIAL_DEBUGGER_BREAK_ON_START = 'Break on start';
const errorTypeConstructors = new Map([
    [test_run_1.UnhandledPromiseRejectionError.name, test_run_1.UnhandledPromiseRejectionError],
    [test_run_1.UncaughtExceptionError.name, test_run_1.UncaughtExceptionError],
]);
class CompilerHost extends async_event_emitter_1.default {
    constructor({ developmentMode, v8Flags }) {
        super();
        this.runtime = Promise.resolve(void 0);
        this.developmentMode = developmentMode;
        this.v8Flags = v8Flags;
        this.initialized = false;
    }
    _setupRoutes(proxy) {
        proxy.register([
            this.executeCommand,
            this.ready,
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
            this.executeAssertionFn,
            this.addUnexpectedError,
            this.checkWindow,
            this.removeTestRunFromState,
            this.removeFixtureCtxsFromState,
            this.removeUnitsFromState,
        ], this);
    }
    _setupDebuggerHandlers() {
        if (!this.cdp)
            return;
        test_run_tracker_1.default.on(debug_action_1.default.resume, async () => {
            if (!this.cdp)
                return;
            const disableDebugMethodName = test_controller_1.default.disableDebugForNonDebugCommands.name;
            // NOTE: disable `debugger` for non-debug commands if the `Resume` button is clicked
            // the `includeCommandLineAPI` option allows to use the `require` functoion in the expression
            // TODO: debugging: refactor to use absolute paths
            await this.cdp.Runtime.evaluate({
                expression: `require.main.require('../../api/test-controller').${disableDebugMethodName}()`,
                includeCommandLineAPI: true,
            });
            await this.cdp.Debugger.resume({ terminateOnResume: false });
        });
        test_run_tracker_1.default.on(debug_action_1.default.step, async () => {
            if (!this.cdp)
                return;
            const enableDebugMethodName = test_controller_1.default.enableDebugForNonDebugCommands.name;
            // NOTE: enable `debugger` for non-debug commands in the `Next Action` button is clicked
            // the `includeCommandLineAPI` option allows to use the `require` functoion in the expression
            // TODO: debugging: refactor to use absolute paths
            await this.cdp.Runtime.evaluate({
                expression: `require.main.require('../../api/test-controller').${enableDebugMethodName}()`,
                includeCommandLineAPI: true,
            });
            await this.cdp.Debugger.resume({ terminateOnResume: false });
        });
        // NOTE: need to step out from the source code until breakpoint is set in the code of test
        // force DebugCommand if breakpoint stopped in the test code
        // TODO: debugging: refactor to this.cdp.Debugger.on('paused') after updating to chrome-remote-interface@0.30.0
        this.cdp.on('Debugger.paused', (args) => {
            const { callFrames } = args;
            if (this.cdp) {
                if (args.reason === INITIAL_DEBUGGER_BREAK_ON_START)
                    return this.cdp.Debugger.resume({ terminateOnResume: false });
                if (callFrames[0].url.includes(INTERNAL_FILES_URL))
                    return this.cdp.Debugger.stepOut();
                Object.values(test_run_tracker_1.default.activeTestRuns).forEach(testRun => {
                    if (!testRun.debugging)
                        testRun.executeCommand(new observation_1.DebugCommand());
                });
            }
            return Promise.resolve();
        });
        // NOTE: need to hide Status Bar if debugger is resumed
        // TODO: debugging: refactor to this.cdp.Debugger.on('resumed') after updating to chrome-remote-interface@0.30.0
        this.cdp.on('Debugger.resumed', () => {
            Object.values(test_run_tracker_1.default.activeTestRuns).forEach(testRun => {
                if (testRun.debugging)
                    testRun.executeCommand(new observation_1.DisableDebugCommand());
            });
        });
    }
    parseDebugPort() {
        if (this.v8Flags) {
            for (let i = 0; i < this.v8Flags.length; i++) {
                const match = this.v8Flags[i].match(INSPECT_PORT_RE);
                if (match)
                    return match[3];
            }
        }
        return null;
    }
    _getServiceProcessArgs(port) {
        let args = [];
        if (this.v8Flags)
            args = this.v8Flags.filter(flag => !INSPECT_RE.test(flag));
        // TODO: debugging: refactor to a separate debug info parsing unit
        const inspectBrkFlag = `--inspect-brk=127.0.0.1:${port}`;
        args.push(inspectBrkFlag, SERVICE_PATH);
        return args;
    }
    async _init(runtime) {
        const resolvedRuntime = await runtime;
        if (resolvedRuntime)
            return resolvedRuntime;
        try {
            const port = this.parseDebugPort() || await (0, endpoint_utils_1.getFreePort)();
            const args = this._getServiceProcessArgs(port.toString());
            const service = (0, child_process_1.spawn)(process.argv0, args, { stdio: [0, 1, 2, 'pipe', 'pipe', 'pipe'] });
            // NOTE: need to wait, otherwise the error will be at `await cdp(...)`
            // TODO: debugging: refactor to use delay and multiple tries
            await new Promise(r => setTimeout(r, 2000));
            // @ts-ignore
            this.cdp = await (0, chrome_remote_interface_1.default)({ port });
            if (!this.cdp)
                return void 0;
            if (!this.developmentMode)
                this._setupDebuggerHandlers();
            await this.cdp.Debugger.enable({});
            await this.cdp.Runtime.enable();
            await this.cdp.Runtime.runIfWaitingForDebugger();
            // HACK: Node.js definition are not correct when additional I/O channels are sp
            const stdio = service.stdio;
            const proxy = new proxy_1.IPCProxy(new transport_1.HostTransport(stdio[io_1.HOST_INPUT_FD], stdio[io_1.HOST_OUTPUT_FD], stdio[io_1.HOST_SYNC_FD]));
            this._setupRoutes(proxy);
            await this.once('ready');
            return { proxy, service };
        }
        catch (e) {
            return void 0;
        }
    }
    async _getRuntime() {
        const runtime = await this.runtime;
        if (!runtime)
            throw new Error('Runtime is not available.');
        return runtime;
    }
    _getTargetTestRun(id) {
        return test_run_tracker_1.default.activeTestRuns[id];
    }
    async init() {
        this.runtime = this._init(this.runtime);
        await this.runtime;
        this.initialized = true;
    }
    async stop() {
        if (!this.initialized)
            return;
        const { service, proxy } = await this._getRuntime();
        service.kill();
        proxy.stop();
    }
    _wrapTestFunction(id, functionName) {
        return async (testRun) => {
            try {
                return await this.runTestFn({ id, functionName, testRunId: testRun.id });
            }
            catch (err) {
                const errList = new error_list_1.default();
                errList.addError(err);
                throw errList;
            }
        };
    }
    _wrapRequestFilterRulePredicate({ testId, hookId, ruleId }) {
        return async (requestInfo) => {
            return await this.executeRequestFilterRulePredicate({ testId, hookId, ruleId, requestInfo });
        };
    }
    _wrapMockPredicate({ mock, testId, hookId, ruleId }) {
        mock.body = async (requestInfo, res) => {
            return await this.executeMockPredicate({ testId, hookId, ruleId, requestInfo, res });
        };
    }
    _getErrorTypeConstructor(type) {
        return errorTypeConstructors.get(type);
    }
    async ready() {
        this.emit('ready');
    }
    executeCommandSync() {
        throw new method_should_not_be_called_error_1.default();
    }
    async executeCommand({ command, id, callsite }) {
        return this
            ._getTargetTestRun(id)
            .executeCommand(command, callsite);
    }
    async getTests({ sourceList, compilerOptions, runnableConfigurationId }, baseUrl) {
        const { proxy } = await this._getRuntime();
        const units = await proxy.call(this.getTests, { sourceList, compilerOptions, runnableConfigurationId }, baseUrl);
        return (0, test_structure_1.restore)(units, (...args) => this._wrapTestFunction(...args), (ruleLocator) => this._wrapRequestFilterRulePredicate(ruleLocator));
    }
    async runTestFn({ id, functionName, testRunId }) {
        const { proxy } = await this._getRuntime();
        return await proxy.call(this.runTestFn, { id, functionName, testRunId });
    }
    async cleanUp() {
        const { proxy } = await this._getRuntime();
        await proxy.call(this.cleanUp);
    }
    async setUserVariables(userVariables) {
        const { proxy } = await this._getRuntime();
        await proxy.call(this.setUserVariables, userVariables);
    }
    async setOptions({ value }) {
        const { proxy } = await this._getRuntime();
        const preparedOptions = (0, prepare_options_1.default)(value);
        await proxy.call(this.setOptions, { value: preparedOptions });
    }
    async onRequestHookEvent({ name, testId, hookId, eventData }) {
        const { proxy } = await this._getRuntime();
        await proxy.call(this.onRequestHookEvent, {
            name,
            testId,
            hookId,
            eventData,
        });
    }
    async setMock({ testId, hookId, ruleId, responseEventId, mock }) {
        if (mock.isPredicate)
            this._wrapMockPredicate({ mock, testId, hookId, ruleId });
        await this.emit('setMock', [responseEventId, mock]);
    }
    async setConfigureResponseEventOptions({ eventId, opts }) {
        await this.emit('setConfigureResponseEventOptions', [eventId, opts]);
    }
    async setHeaderOnConfigureResponseEvent({ eventId, headerName, headerValue }) {
        await this.emit('setHeaderOnConfigureResponseEvent', [eventId, headerName, headerValue]);
    }
    async removeHeaderOnConfigureResponseEvent({ eventId, headerName }) {
        await this.emit('removeHeaderOnConfigureResponseEvent', [eventId, headerName]);
    }
    async executeRequestFilterRulePredicate({ testId, hookId, ruleId, requestInfo }) {
        const { proxy } = await this._getRuntime();
        return await proxy.call(this.executeRequestFilterRulePredicate, { testId, hookId, ruleId, requestInfo });
    }
    async executeMockPredicate({ testId, hookId, ruleId, requestInfo, res }) {
        const { proxy } = await this._getRuntime();
        return await proxy.call(this.executeMockPredicate, { testId, hookId, ruleId, requestInfo, res });
    }
    async getWarningMessages({ testRunId }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.getWarningMessages, { testRunId });
    }
    async addRequestEventListeners({ hookId, hookClassName, rules }) {
        await this.emit('addRequestEventListeners', { hookId, hookClassName, rules });
    }
    async removeRequestEventListeners({ rules }) {
        await this.emit('removeRequestEventListeners', { rules });
    }
    async initializeTestRunData({ testRunId, testId, browser, activeWindowId, messageBus }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.initializeTestRunData, { testRunId, testId, browser, activeWindowId, messageBus });
    }
    async getAssertionActualValue({ testRunId, commandId }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.getAssertionActualValue, { testRunId, commandId: commandId });
    }
    async executeRoleInitFn({ testRunId, roleId }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.executeRoleInitFn, { testRunId, roleId });
    }
    async getCtx({ testRunId }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.getCtx, { testRunId });
    }
    async getFixtureCtx({ testRunId }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.getFixtureCtx, { testRunId });
    }
    async setCtx({ testRunId, value }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.setCtx, { testRunId, value });
    }
    async setFixtureCtx({ testRunId, value }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.setFixtureCtx, { testRunId, value });
    }
    onRoleAppeared() {
        throw new method_should_not_be_called_error_1.default();
    }
    async updateRoleProperty({ roleId, name, value }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.updateRoleProperty, { roleId, name, value });
    }
    async executeJsExpression({ expression, testRunId, options }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.executeJsExpression, { expression, testRunId, options });
    }
    async executeAsyncJsExpression({ expression, testRunId, callsite }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.executeAsyncJsExpression, { expression, testRunId, callsite });
    }
    async executeAssertionFn({ testRunId, commandId }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.executeAssertionFn, { testRunId, commandId });
    }
    async addUnexpectedError({ type, message }) {
        const ErrorTypeConstructor = this._getErrorTypeConstructor(type);
        (0, handle_errors_1.handleUnexpectedError)(ErrorTypeConstructor, message);
    }
    async checkWindow({ testRunId, commandId, url, title }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.checkWindow, { testRunId, commandId, url, title });
    }
    async removeTestRunFromState({ testRunId }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.removeTestRunFromState, { testRunId });
    }
    async removeFixtureCtxsFromState({ fixtureIds }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.removeFixtureCtxsFromState, { fixtureIds });
    }
    async removeUnitsFromState({ runnableConfigurationId }) {
        const { proxy } = await this._getRuntime();
        return proxy.call(this.removeUnitsFromState, { runnableConfigurationId });
    }
}
exports.default = CompilerHost;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG9zdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zZXJ2aWNlcy9jb21waWxlci9ob3N0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsZ0RBQXdCO0FBQ3hCLDZCQUFvQztBQUNwQyxzRkFBMEM7QUFFMUMsaURBQW9EO0FBQ3BELG1EQUE2QztBQUU3Qyw2QkFJYztBQUVkLG9FQUFrRjtBQUNsRix1RkFBOEQ7QUFDOUQsa0ZBQXVFO0FBQ3ZFLGdGQUF1RDtBQUV2RCw4Q0FBOEM7QUFDOUMsc0RBQXVEO0FBQ3ZELDBGQUFnRTtBQUNoRSx5RUFBd0Q7QUFDeEQsNEVBQW9EO0FBaUJwRCxxRUFBd0Y7QUFDeEYsbUhBQXNGO0FBNkJ0RixvREFBK0Y7QUFDL0YsNkRBQWtFO0FBQ2xFLDJFQUFpRTtBQUdqRSxNQUFNLFlBQVksR0FBUyxPQUFPLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDL0QsTUFBTSxrQkFBa0IsR0FBRyxJQUFBLG1CQUFhLEVBQUMsY0FBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUV6RSxNQUFNLFVBQVUsR0FBUSxJQUFJLE1BQU0sQ0FBQyxLQUFLLHNDQUFjLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNyRSxNQUFNLGVBQWUsR0FBRyxJQUFJLE1BQU0sQ0FBQyxLQUFLLHNDQUFjLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBbUJuRixNQUFNLCtCQUErQixHQUFHLGdCQUFnQixDQUFDO0FBRXpELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxHQUFHLENBQW1CO0lBQ3BELENBQUMseUNBQThCLENBQUMsSUFBSSxFQUFFLHlDQUE4QixDQUFDO0lBQ3JFLENBQUMsaUNBQXNCLENBQUMsSUFBSSxFQUFFLGlDQUFzQixDQUFDO0NBQ3hELENBQUMsQ0FBQztBQU9ILE1BQXFCLFlBQWEsU0FBUSw2QkFBaUI7SUFPdkQsWUFBb0IsRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUEyQjtRQUNyRSxLQUFLLEVBQUUsQ0FBQztRQUVSLElBQUksQ0FBQyxPQUFPLEdBQVcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxlQUFlLEdBQUcsZUFBZSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxPQUFPLEdBQVcsT0FBTyxDQUFDO1FBQy9CLElBQUksQ0FBQyxXQUFXLEdBQU8sS0FBSyxDQUFDO0lBQ2pDLENBQUM7SUFFTyxZQUFZLENBQUUsS0FBZTtRQUNqQyxLQUFLLENBQUMsUUFBUSxDQUFDO1lBQ1gsSUFBSSxDQUFDLGNBQWM7WUFDbkIsSUFBSSxDQUFDLEtBQUs7WUFDVixJQUFJLENBQUMsa0JBQWtCO1lBQ3ZCLElBQUksQ0FBQyxPQUFPO1lBQ1osSUFBSSxDQUFDLGdDQUFnQztZQUNyQyxJQUFJLENBQUMsaUNBQWlDO1lBQ3RDLElBQUksQ0FBQyxvQ0FBb0M7WUFDekMsSUFBSSxDQUFDLGlDQUFpQztZQUN0QyxJQUFJLENBQUMsb0JBQW9CO1lBQ3pCLElBQUksQ0FBQyxrQkFBa0I7WUFDdkIsSUFBSSxDQUFDLHdCQUF3QjtZQUM3QixJQUFJLENBQUMsMkJBQTJCO1lBQ2hDLElBQUksQ0FBQyxxQkFBcUI7WUFDMUIsSUFBSSxDQUFDLHVCQUF1QjtZQUM1QixJQUFJLENBQUMsaUJBQWlCO1lBQ3RCLElBQUksQ0FBQyxNQUFNO1lBQ1gsSUFBSSxDQUFDLGFBQWE7WUFDbEIsSUFBSSxDQUFDLE1BQU07WUFDWCxJQUFJLENBQUMsYUFBYTtZQUNsQixJQUFJLENBQUMsa0JBQWtCO1lBQ3ZCLElBQUksQ0FBQyxtQkFBbUI7WUFDeEIsSUFBSSxDQUFDLHdCQUF3QjtZQUM3QixJQUFJLENBQUMsa0JBQWtCO1lBQ3ZCLElBQUksQ0FBQyxrQkFBa0I7WUFDdkIsSUFBSSxDQUFDLFdBQVc7WUFDaEIsSUFBSSxDQUFDLHNCQUFzQjtZQUMzQixJQUFJLENBQUMsMEJBQTBCO1lBQy9CLElBQUksQ0FBQyxvQkFBb0I7U0FDNUIsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNiLENBQUM7SUFFTyxzQkFBc0I7UUFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHO1lBQ1QsT0FBTztRQUVYLDBCQUFjLENBQUMsRUFBRSxDQUFDLHNCQUFZLENBQUMsTUFBTSxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzlDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRztnQkFDVCxPQUFPO1lBRVgsTUFBTSxzQkFBc0IsR0FBRyx5QkFBYyxDQUFDLCtCQUErQixDQUFDLElBQUksQ0FBQztZQUVuRixvRkFBb0Y7WUFDcEYsNkZBQTZGO1lBQzdGLGtEQUFrRDtZQUNsRCxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQztnQkFDNUIsVUFBVSxFQUFhLHFEQUFxRCxzQkFBc0IsSUFBSTtnQkFDdEcscUJBQXFCLEVBQUUsSUFBSTthQUM5QixDQUFDLENBQUM7WUFFSCxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLGlCQUFpQixFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDakUsQ0FBQyxDQUFDLENBQUM7UUFFSCwwQkFBYyxDQUFDLEVBQUUsQ0FBQyxzQkFBWSxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksRUFBRTtZQUM1QyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUc7Z0JBQ1QsT0FBTztZQUVYLE1BQU0scUJBQXFCLEdBQUcseUJBQWMsQ0FBQyw4QkFBOEIsQ0FBQyxJQUFJLENBQUM7WUFFakYsd0ZBQXdGO1lBQ3hGLDZGQUE2RjtZQUM3RixrREFBa0Q7WUFDbEQsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUM7Z0JBQzVCLFVBQVUsRUFBYSxxREFBcUQscUJBQXFCLElBQUk7Z0JBQ3JHLHFCQUFxQixFQUFFLElBQUk7YUFDOUIsQ0FBQyxDQUFDO1lBRUgsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ2pFLENBQUMsQ0FBQyxDQUFDO1FBRUgsMEZBQTBGO1FBQzFGLDREQUE0RDtRQUM1RCwrR0FBK0c7UUFDL0csSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxJQUFTLEVBQWlCLEVBQUU7WUFDeEQsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQztZQUU1QixJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUU7Z0JBQ1YsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLCtCQUErQjtvQkFDL0MsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO2dCQUVsRSxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDO29CQUM5QyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUV2QyxNQUFNLENBQUMsTUFBTSxDQUFDLDBCQUFjLENBQUMsY0FBYyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO29CQUMzRCxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVM7d0JBQ2xCLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSwwQkFBWSxFQUFFLENBQUMsQ0FBQztnQkFDbkQsQ0FBQyxDQUFDLENBQUM7YUFDTjtZQUVELE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQzdCLENBQUMsQ0FBQyxDQUFDO1FBRUgsdURBQXVEO1FBQ3ZELGdIQUFnSDtRQUNoSCxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUU7WUFDakMsTUFBTSxDQUFDLE1BQU0sQ0FBQywwQkFBYyxDQUFDLGNBQWMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtnQkFDM0QsSUFBSSxPQUFPLENBQUMsU0FBUztvQkFDakIsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLGlDQUFtQixFQUFFLENBQUMsQ0FBQztZQUMxRCxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVPLGNBQWM7UUFDbEIsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2QsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUMxQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztnQkFFckQsSUFBSSxLQUFLO29CQUNMLE9BQU8sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ3ZCO1NBQ0o7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBRU8sc0JBQXNCLENBQUUsSUFBWTtRQUN4QyxJQUFJLElBQUksR0FBYSxFQUFFLENBQUM7UUFFeEIsSUFBSSxJQUFJLENBQUMsT0FBTztZQUNaLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRS9ELGtFQUFrRTtRQUNsRSxNQUFNLGNBQWMsR0FBRywyQkFBMkIsSUFBSSxFQUFFLENBQUM7UUFFekQsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFFeEMsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVPLEtBQUssQ0FBQyxLQUFLLENBQUUsT0FBNEM7UUFDN0QsTUFBTSxlQUFlLEdBQUcsTUFBTSxPQUFPLENBQUM7UUFFdEMsSUFBSSxlQUFlO1lBQ2YsT0FBTyxlQUFlLENBQUM7UUFFM0IsSUFBSTtZQUNBLE1BQU0sSUFBSSxHQUFNLElBQUksQ0FBQyxjQUFjLEVBQUUsSUFBSSxNQUFNLElBQUEsNEJBQVcsR0FBRSxDQUFDO1lBQzdELE1BQU0sSUFBSSxHQUFNLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUM3RCxNQUFNLE9BQU8sR0FBRyxJQUFBLHFCQUFLLEVBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUV6RixzRUFBc0U7WUFDdEUsNERBQTREO1lBQzVELE1BQU0sSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7WUFFNUMsYUFBYTtZQUNiLElBQUksQ0FBQyxHQUFHLEdBQUcsTUFBTSxJQUFBLGlDQUFHLEVBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBRS9CLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRztnQkFDVCxPQUFPLEtBQUssQ0FBQyxDQUFDO1lBRWxCLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZTtnQkFDckIsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7WUFFbEMsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDbkMsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNoQyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLHVCQUF1QixFQUFFLENBQUM7WUFFakQsK0VBQStFO1lBQy9FLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFZLENBQUM7WUFDbkMsTUFBTSxLQUFLLEdBQUcsSUFBSSxnQkFBUSxDQUFDLElBQUkseUJBQWEsQ0FBQyxLQUFLLENBQUMsa0JBQWEsQ0FBQyxFQUFFLEtBQUssQ0FBQyxtQkFBYyxDQUFDLEVBQUUsS0FBSyxDQUFDLGlCQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFaEgsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUV6QixNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFFekIsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsQ0FBQztTQUM3QjtRQUNELE9BQU8sQ0FBQyxFQUFFO1lBQ04sT0FBTyxLQUFLLENBQUMsQ0FBQztTQUNqQjtJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsV0FBVztRQUNyQixNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUM7UUFFbkMsSUFBSSxDQUFDLE9BQU87WUFDUixNQUFNLElBQUksS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFFakQsT0FBTyxPQUFPLENBQUM7SUFDbkIsQ0FBQztJQUVPLGlCQUFpQixDQUFFLEVBQVU7UUFDakMsT0FBTywwQkFBYyxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQXVCLENBQUM7SUFDbkUsQ0FBQztJQUVNLEtBQUssQ0FBQyxJQUFJO1FBQ2IsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUV4QyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUM7UUFFbkIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDNUIsQ0FBQztJQUVNLEtBQUssQ0FBQyxJQUFJO1FBQ2IsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXO1lBQ2pCLE9BQU87UUFFWCxNQUFNLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRXBELE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNmLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNqQixDQUFDO0lBRU8saUJBQWlCLENBQUUsRUFBVSxFQUFFLFlBQWdDO1FBQ25FLE9BQU8sS0FBSyxFQUFDLE9BQU8sRUFBQyxFQUFFO1lBQ25CLElBQUk7Z0JBQ0EsT0FBTyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxFQUFFLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQzthQUM1RTtZQUNELE9BQU8sR0FBRyxFQUFFO2dCQUNSLE1BQU0sT0FBTyxHQUFHLElBQUksb0JBQWlCLEVBQUUsQ0FBQztnQkFFeEMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFFdEIsTUFBTSxPQUFPLENBQUM7YUFDakI7UUFDTCxDQUFDLENBQUM7SUFDTixDQUFDO0lBRU8sK0JBQStCLENBQUUsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBNEI7UUFDekYsT0FBTyxLQUFLLEVBQUUsV0FBd0IsRUFBRSxFQUFFO1lBQ3RDLE9BQU8sTUFBTSxJQUFJLENBQUMsaUNBQWlDLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBQ2pHLENBQUMsQ0FBQztJQUNOLENBQUM7SUFFTyxrQkFBa0IsQ0FBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBOEI7UUFDcEYsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFLLEVBQUUsV0FBd0IsRUFBRSxHQUFtQyxFQUFFLEVBQUU7WUFDaEYsT0FBTyxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ3pGLENBQUMsQ0FBQztJQUNOLENBQUM7SUFFTyx3QkFBd0IsQ0FBRSxJQUFZO1FBQzFDLE9BQU8scUJBQXFCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBYSxDQUFDO0lBQ3ZELENBQUM7SUFFTSxLQUFLLENBQUMsS0FBSztRQUNkLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDdkIsQ0FBQztJQUVNLGtCQUFrQjtRQUNyQixNQUFNLElBQUksMkNBQTRCLEVBQUUsQ0FBQztJQUM3QyxDQUFDO0lBRU0sS0FBSyxDQUFDLGNBQWMsQ0FBRSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUEyQjtRQUMzRSxPQUFPLElBQUk7YUFDTixpQkFBaUIsQ0FBQyxFQUFFLENBQUM7YUFDckIsY0FBYyxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRU0sS0FBSyxDQUFDLFFBQVEsQ0FBRSxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsdUJBQXVCLEVBQXFCLEVBQUUsT0FBZ0I7UUFDaEgsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRTNDLE1BQU0sS0FBSyxHQUFHLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSx1QkFBdUIsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRWpILE9BQU8sSUFBQSx3QkFBb0IsRUFDdkIsS0FBSyxFQUNMLENBQUMsR0FBRyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLElBQUksQ0FBQyxFQUM1QyxDQUFDLFdBQXFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxXQUFXLENBQUMsQ0FDL0YsQ0FBQztJQUNOLENBQUM7SUFFTSxLQUFLLENBQUMsU0FBUyxDQUFFLEVBQUUsRUFBRSxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQW9CO1FBQ3JFLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUUzQyxPQUFPLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLEVBQUUsRUFBRSxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQzdFLENBQUM7SUFFTSxLQUFLLENBQUMsT0FBTztRQUNoQixNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFM0MsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRU0sS0FBSyxDQUFDLGdCQUFnQixDQUFFLGFBQW1DO1FBQzlELE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUUzQyxNQUFNLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzNELENBQUM7SUFHTSxLQUFLLENBQUMsVUFBVSxDQUFFLEVBQUUsS0FBSyxFQUF1QjtRQUNuRCxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFM0MsTUFBTSxlQUFlLEdBQUcsSUFBQSx5QkFBYyxFQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTlDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBRSxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUVNLEtBQUssQ0FBQyxrQkFBa0IsQ0FBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBNkI7UUFDM0YsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRTNDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUU7WUFDdEMsSUFBSTtZQUNKLE1BQU07WUFDTixNQUFNO1lBQ04sU0FBUztTQUNaLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTSxLQUFLLENBQUMsT0FBTyxDQUFFLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLElBQUksRUFBb0I7UUFDckYsSUFBSSxJQUFJLENBQUMsV0FBVztZQUNoQixJQUFJLENBQUMsa0JBQWtCLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBRTlELE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN4RCxDQUFDO0lBRU0sS0FBSyxDQUFDLGdDQUFnQyxDQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBNkM7UUFDdkcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGtDQUFrQyxFQUFFLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDekUsQ0FBQztJQUVNLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBRSxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUE4QztRQUM1SCxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsbUNBQW1DLEVBQUUsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDN0YsQ0FBQztJQUVNLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBRSxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQWlEO1FBQ3JILE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxzQ0FBc0MsRUFBRSxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBQ25GLENBQUM7SUFFTSxLQUFLLENBQUMsaUNBQWlDLENBQUUsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQThDO1FBQy9ILE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUUzQyxPQUFPLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsaUNBQWlDLEVBQUUsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQzdHLENBQUM7SUFFTSxLQUFLLENBQUMsb0JBQW9CLENBQUUsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUF3QjtRQUNqRyxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFM0MsT0FBTyxNQUFNLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQixFQUFFLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDckcsQ0FBQztJQUVNLEtBQUssQ0FBQyxrQkFBa0IsQ0FBRSxFQUFFLFNBQVMsRUFBa0I7UUFDMUQsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRTNDLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQzlELENBQUM7SUFFTSxLQUFLLENBQUMsd0JBQXdCLENBQUcsRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBcUM7UUFDdkcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLDBCQUEwQixFQUFFLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ2xGLENBQUM7SUFFTSxLQUFLLENBQUMsMkJBQTJCLENBQUUsRUFBRSxLQUFLLEVBQXdDO1FBQ3JGLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyw2QkFBNkIsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDOUQsQ0FBQztJQUVNLEtBQUssQ0FBQyxxQkFBcUIsQ0FBRSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxVQUFVLEVBQWtDO1FBQzFILE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUUzQyxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHFCQUFxQixFQUFFLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDOUcsQ0FBQztJQUVNLEtBQUssQ0FBQyx1QkFBdUIsQ0FBRSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQWtCO1FBQzFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUUzQyxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ3pGLENBQUM7SUFFTSxLQUFLLENBQUMsaUJBQWlCLENBQUUsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUE4QjtRQUM3RSxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFM0MsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ3JFLENBQUM7SUFFTSxLQUFLLENBQUMsTUFBTSxDQUFFLEVBQUUsU0FBUyxFQUFrQjtRQUM5QyxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFM0MsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFTSxLQUFLLENBQUMsYUFBYSxDQUFFLEVBQUUsU0FBUyxFQUFrQjtRQUNyRCxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFM0MsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ3pELENBQUM7SUFFTSxLQUFLLENBQUMsTUFBTSxDQUFFLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBbUI7UUFDdEQsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRTNDLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUVNLEtBQUssQ0FBQyxhQUFhLENBQUUsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFtQjtRQUM3RCxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFM0MsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRU0sY0FBYztRQUNqQixNQUFNLElBQUksMkNBQTRCLEVBQUUsQ0FBQztJQUM3QyxDQUFDO0lBRU0sS0FBSyxDQUFDLGtCQUFrQixDQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQStCO1FBQ2pGLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUUzQyxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFFTSxLQUFLLENBQUMsbUJBQW1CLENBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBZ0M7UUFDOUYsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRTNDLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDcEYsQ0FBQztJQUVNLEtBQUssQ0FBQyx3QkFBd0IsQ0FBRSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFxQztRQUN6RyxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFM0MsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUMxRixDQUFDO0lBRU0sS0FBSyxDQUFDLGtCQUFrQixDQUFFLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBa0I7UUFDckUsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRTNDLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRU0sS0FBSyxDQUFDLGtCQUFrQixDQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBK0I7UUFDM0UsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFakUsSUFBQSxxQ0FBcUIsRUFBQyxvQkFBb0IsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBRU0sS0FBSyxDQUFDLFdBQVcsQ0FBRSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBdUI7UUFDL0UsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRTNDLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBRU0sS0FBSyxDQUFDLHNCQUFzQixDQUFFLEVBQUUsU0FBUyxFQUFrQjtRQUM5RCxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFM0MsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUVNLEtBQUssQ0FBQywwQkFBMEIsQ0FBRSxFQUFFLFVBQVUsRUFBOEI7UUFDL0UsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRTNDLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFFTSxLQUFLLENBQUMsb0JBQW9CLENBQUUsRUFBRSx1QkFBdUIsRUFBaUM7UUFDekYsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRTNDLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsRUFBRSx1QkFBdUIsRUFBRSxDQUFDLENBQUM7SUFDOUUsQ0FBQztDQUNKO0FBM2NELCtCQTJjQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgY2RwIGZyb20gJ2Nocm9tZS1yZW1vdGUtaW50ZXJmYWNlJztcbmltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnZXZlbnRzJztcbmltcG9ydCB7IHNwYXduLCBDaGlsZFByb2Nlc3MgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IGdldEZyZWVQb3J0IH0gZnJvbSAnZW5kcG9pbnQtdXRpbHMnO1xuXG5pbXBvcnQge1xuICAgIEhPU1RfSU5QVVRfRkQsXG4gICAgSE9TVF9PVVRQVVRfRkQsXG4gICAgSE9TVF9TWU5DX0ZELFxufSBmcm9tICcuL2lvJztcblxuaW1wb3J0IHsgcmVzdG9yZSBhcyByZXN0b3JlVGVzdFN0cnVjdHVyZSB9IGZyb20gJy4uL3NlcmlhbGl6YXRpb24vdGVzdC1zdHJ1Y3R1cmUnO1xuaW1wb3J0IHByZXBhcmVPcHRpb25zIGZyb20gJy4uL3NlcmlhbGl6YXRpb24vcHJlcGFyZS1vcHRpb25zJztcbmltcG9ydCB7IGRlZmF1bHQgYXMgdGVzdFJ1blRyYWNrZXIgfSBmcm9tICcuLi8uLi9hcGkvdGVzdC1ydW4tdHJhY2tlcic7XG5pbXBvcnQgVGVzdENvbnRyb2xsZXIgZnJvbSAnLi4vLi4vYXBpL3Rlc3QtY29udHJvbGxlcic7XG5pbXBvcnQgVGVzdFJ1biBmcm9tICcuLi8uLi90ZXN0LXJ1bic7XG5pbXBvcnQgeyBJUENQcm94eSB9IGZyb20gJy4uL3V0aWxzL2lwYy9wcm94eSc7XG5pbXBvcnQgeyBIb3N0VHJhbnNwb3J0IH0gZnJvbSAnLi4vdXRpbHMvaXBjL3RyYW5zcG9ydCc7XG5pbXBvcnQgQXN5bmNFdmVudEVtaXR0ZXIgZnJvbSAnLi4vLi4vdXRpbHMvYXN5bmMtZXZlbnQtZW1pdHRlcic7XG5pbXBvcnQgVGVzdENhZmVFcnJvckxpc3QgZnJvbSAnLi4vLi4vZXJyb3JzL2Vycm9yLWxpc3QnO1xuaW1wb3J0IERFQlVHX0FDVElPTiBmcm9tICcuLi8uLi91dGlscy9kZWJ1Zy1hY3Rpb24nO1xuXG5pbXBvcnQge1xuICAgIENvbXBpbGVyUHJvdG9jb2wsXG4gICAgUnVuVGVzdEFyZ3VtZW50cyxcbiAgICBGdW5jdGlvblByb3BlcnRpZXMsXG59IGZyb20gJy4vcHJvdG9jb2wnO1xuXG5pbXBvcnQgeyBDb21waWxlckFyZ3VtZW50cyB9IGZyb20gJy4uLy4uL2NvbXBpbGVyL2ludGVyZmFjZXMnO1xuaW1wb3J0IFRlc3QgZnJvbSAnLi4vLi4vYXBpL3N0cnVjdHVyZS90ZXN0JztcblxuaW1wb3J0IHtcbiAgICBSZXF1ZXN0SW5mbyxcbiAgICBSZXNwb25zZU1vY2ssXG4gICAgSW5jb21pbmdNZXNzYWdlTGlrZUluaXRPcHRpb25zLFxufSBmcm9tICd0ZXN0Y2FmZS1oYW1tZXJoZWFkJztcblxuaW1wb3J0IHsgRGVidWdDb21tYW5kLCBEaXNhYmxlRGVidWdDb21tYW5kIH0gZnJvbSAnLi4vLi4vdGVzdC1ydW4vY29tbWFuZHMvb2JzZXJ2YXRpb24nO1xuaW1wb3J0IE1ldGhvZFNob3VsZE5vdEJlQ2FsbGVkRXJyb3IgZnJvbSAnLi4vdXRpbHMvbWV0aG9kLXNob3VsZC1ub3QtYmUtY2FsbGVkLWVycm9yJztcblxuaW1wb3J0IHtcbiAgICBBZGRSZXF1ZXN0RXZlbnRMaXN0ZW5lcnNBcmd1bWVudHMsXG4gICAgRXhlY3V0ZUNvbW1hbmRBcmd1bWVudHMsXG4gICAgRXhlY3V0ZU1vY2tQcmVkaWNhdGUsXG4gICAgRXhlY3V0ZVJlcXVlc3RGaWx0ZXJSdWxlUHJlZGljYXRlQXJndW1lbnRzLFxuICAgIEV4ZWN1dGVSb2xlSW5pdEZuQXJndW1lbnRzLFxuICAgIEluaXRpYWxpemVUZXN0UnVuRGF0YUFyZ3VtZW50cyxcbiAgICBSZW1vdmVIZWFkZXJPbkNvbmZpZ3VyZVJlc3BvbnNlRXZlbnRBcmd1bWVudHMsXG4gICAgUmVtb3ZlUmVxdWVzdEV2ZW50TGlzdGVuZXJzQXJndW1lbnRzLFxuICAgIFJlcXVlc3RGaWx0ZXJSdWxlTG9jYXRvcixcbiAgICBSZXF1ZXN0SG9va0V2ZW50QXJndW1lbnRzLFxuICAgIFNldENvbmZpZ3VyZVJlc3BvbnNlRXZlbnRPcHRpb25zQXJndW1lbnRzLFxuICAgIFNldEN0eEFyZ3VtZW50cyxcbiAgICBTZXRNb2NrQXJndW1lbnRzLFxuICAgIFNldEhlYWRlck9uQ29uZmlndXJlUmVzcG9uc2VFdmVudEFyZ3VtZW50cyxcbiAgICBTZXRPcHRpb25zQXJndW1lbnRzLFxuICAgIFRlc3RSdW5Mb2NhdG9yLFxuICAgIFVwZGF0ZVJvbGVQcm9wZXJ0eUFyZ3VtZW50cyxcbiAgICBFeGVjdXRlSnNFeHByZXNzaW9uQXJndW1lbnRzLFxuICAgIEV4ZWN1dGVBc3luY0pzRXhwcmVzc2lvbkFyZ3VtZW50cyxcbiAgICBDb21tYW5kTG9jYXRvcixcbiAgICBBZGRVbmV4cGVjdGVkRXJyb3JBcmd1bWVudHMsXG4gICAgQ2hlY2tXaW5kb3dBcmd1bWVudCxcbiAgICBSZW1vdmVGaXh0dXJlQ3R4c0FyZ3VtZW50cyxcbiAgICBSZW1vdmVVbml0c0Zyb21TdGF0ZUFyZ3VtZW50cyxcbn0gZnJvbSAnLi9pbnRlcmZhY2VzJztcblxuaW1wb3J0IHsgVW5jYXVnaHRFeGNlcHRpb25FcnJvciwgVW5oYW5kbGVkUHJvbWlzZVJlamVjdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vZXJyb3JzL3Rlc3QtcnVuJztcbmltcG9ydCB7IGhhbmRsZVVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2hhbmRsZS1lcnJvcnMnO1xuaW1wb3J0IHsgVjhfREVCVUdfRkxBR1MgfSBmcm9tICcuLi8uLi9jbGkvbm9kZS1hcmd1bWVudHMtZmlsdGVyJztcbmltcG9ydCB7IFdhcm5pbmdMb2dNZXNzYWdlIH0gZnJvbSAnLi4vLi4vbm90aWZpY2F0aW9ucy93YXJuaW5nLWxvZyc7XG5cbmNvbnN0IFNFUlZJQ0VfUEFUSCAgICAgICA9IHJlcXVpcmUucmVzb2x2ZSgnLi9zZXJ2aWNlLWxvYWRlcicpO1xuY29uc3QgSU5URVJOQUxfRklMRVNfVVJMID0gcGF0aFRvRmlsZVVSTChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vJykpO1xuXG5jb25zdCBJTlNQRUNUX1JFICAgICAgPSBuZXcgUmVnRXhwKGBeKCR7VjhfREVCVUdfRkxBR1Muam9pbignfCcpfSlgKTtcbmNvbnN0IElOU1BFQ1RfUE9SVF9SRSA9IG5ldyBSZWdFeHAoYF4oJHtWOF9ERUJVR19GTEFHUy5qb2luKCd8Jyl9KT0oLis6KT8oXFxcXGQrKSRgKTtcblxuaW50ZXJmYWNlIFJ1bnRpbWVSZXNvdXJjZXMge1xuICAgIHNlcnZpY2U6IENoaWxkUHJvY2VzcztcbiAgICBwcm94eTogSVBDUHJveHk7XG59XG5cbmludGVyZmFjZSBUZXN0RnVuY3Rpb24ge1xuICAgICh0ZXN0UnVuOiBUZXN0UnVuKTogUHJvbWlzZTx1bmtub3duPjtcbn1cblxuaW50ZXJmYWNlIFJlcXVlc3RGaWx0ZXJSdWxlUHJlZGljYXRlIHtcbiAgICAocmVxdWVzdEluZm86IFJlcXVlc3RJbmZvKTogUHJvbWlzZTxib29sZWFuPjtcbn1cblxuaW50ZXJmYWNlIFdyYXBNb2NrUHJlZGljYXRlQXJndW1lbnRzIGV4dGVuZHMgUmVxdWVzdEZpbHRlclJ1bGVMb2NhdG9yIHtcbiAgICBtb2NrOiBSZXNwb25zZU1vY2s7XG59XG5cbmNvbnN0IElOSVRJQUxfREVCVUdHRVJfQlJFQUtfT05fU1RBUlQgPSAnQnJlYWsgb24gc3RhcnQnO1xuXG5jb25zdCBlcnJvclR5cGVDb25zdHJ1Y3RvcnMgPSBuZXcgTWFwPHN0cmluZywgRnVuY3Rpb24+KFtcbiAgICBbVW5oYW5kbGVkUHJvbWlzZVJlamVjdGlvbkVycm9yLm5hbWUsIFVuaGFuZGxlZFByb21pc2VSZWplY3Rpb25FcnJvcl0sXG4gICAgW1VuY2F1Z2h0RXhjZXB0aW9uRXJyb3IubmFtZSwgVW5jYXVnaHRFeGNlcHRpb25FcnJvcl0sXG5dKTtcblxuaW50ZXJmYWNlIENvbXBpbGVySG9zdEluaXRPcHRpb25zIHtcbiAgICBkZXZlbG9wbWVudE1vZGU6IGJvb2xlYW47XG4gICAgdjhGbGFnczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENvbXBpbGVySG9zdCBleHRlbmRzIEFzeW5jRXZlbnRFbWl0dGVyIGltcGxlbWVudHMgQ29tcGlsZXJQcm90b2NvbCB7XG4gICAgcHJpdmF0ZSBydW50aW1lOiBQcm9taXNlPFJ1bnRpbWVSZXNvdXJjZXN8dW5kZWZpbmVkPjtcbiAgICBwcml2YXRlIGNkcDogY2RwLlByb3RvY29sQXBpICYgRXZlbnRFbWl0dGVyIHwgdW5kZWZpbmVkO1xuICAgIHByaXZhdGUgcmVhZG9ubHkgZGV2ZWxvcG1lbnRNb2RlOiBib29sZWFuO1xuICAgIHByaXZhdGUgcmVhZG9ubHkgdjhGbGFnczogc3RyaW5nW107XG4gICAgcHVibGljIGluaXRpYWxpemVkOiBib29sZWFuO1xuXG4gICAgcHVibGljIGNvbnN0cnVjdG9yICh7IGRldmVsb3BtZW50TW9kZSwgdjhGbGFncyB9OiBDb21waWxlckhvc3RJbml0T3B0aW9ucykge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMucnVudGltZSAgICAgICAgID0gUHJvbWlzZS5yZXNvbHZlKHZvaWQgMCk7XG4gICAgICAgIHRoaXMuZGV2ZWxvcG1lbnRNb2RlID0gZGV2ZWxvcG1lbnRNb2RlO1xuICAgICAgICB0aGlzLnY4RmxhZ3MgICAgICAgICA9IHY4RmxhZ3M7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgICAgID0gZmFsc2U7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfc2V0dXBSb3V0ZXMgKHByb3h5OiBJUENQcm94eSk6IHZvaWQge1xuICAgICAgICBwcm94eS5yZWdpc3RlcihbXG4gICAgICAgICAgICB0aGlzLmV4ZWN1dGVDb21tYW5kLFxuICAgICAgICAgICAgdGhpcy5yZWFkeSxcbiAgICAgICAgICAgIHRoaXMub25SZXF1ZXN0SG9va0V2ZW50LFxuICAgICAgICAgICAgdGhpcy5zZXRNb2NrLFxuICAgICAgICAgICAgdGhpcy5zZXRDb25maWd1cmVSZXNwb25zZUV2ZW50T3B0aW9ucyxcbiAgICAgICAgICAgIHRoaXMuc2V0SGVhZGVyT25Db25maWd1cmVSZXNwb25zZUV2ZW50LFxuICAgICAgICAgICAgdGhpcy5yZW1vdmVIZWFkZXJPbkNvbmZpZ3VyZVJlc3BvbnNlRXZlbnQsXG4gICAgICAgICAgICB0aGlzLmV4ZWN1dGVSZXF1ZXN0RmlsdGVyUnVsZVByZWRpY2F0ZSxcbiAgICAgICAgICAgIHRoaXMuZXhlY3V0ZU1vY2tQcmVkaWNhdGUsXG4gICAgICAgICAgICB0aGlzLmdldFdhcm5pbmdNZXNzYWdlcyxcbiAgICAgICAgICAgIHRoaXMuYWRkUmVxdWVzdEV2ZW50TGlzdGVuZXJzLFxuICAgICAgICAgICAgdGhpcy5yZW1vdmVSZXF1ZXN0RXZlbnRMaXN0ZW5lcnMsXG4gICAgICAgICAgICB0aGlzLmluaXRpYWxpemVUZXN0UnVuRGF0YSxcbiAgICAgICAgICAgIHRoaXMuZ2V0QXNzZXJ0aW9uQWN0dWFsVmFsdWUsXG4gICAgICAgICAgICB0aGlzLmV4ZWN1dGVSb2xlSW5pdEZuLFxuICAgICAgICAgICAgdGhpcy5nZXRDdHgsXG4gICAgICAgICAgICB0aGlzLmdldEZpeHR1cmVDdHgsXG4gICAgICAgICAgICB0aGlzLnNldEN0eCxcbiAgICAgICAgICAgIHRoaXMuc2V0Rml4dHVyZUN0eCxcbiAgICAgICAgICAgIHRoaXMudXBkYXRlUm9sZVByb3BlcnR5LFxuICAgICAgICAgICAgdGhpcy5leGVjdXRlSnNFeHByZXNzaW9uLFxuICAgICAgICAgICAgdGhpcy5leGVjdXRlQXN5bmNKc0V4cHJlc3Npb24sXG4gICAgICAgICAgICB0aGlzLmV4ZWN1dGVBc3NlcnRpb25GbixcbiAgICAgICAgICAgIHRoaXMuYWRkVW5leHBlY3RlZEVycm9yLFxuICAgICAgICAgICAgdGhpcy5jaGVja1dpbmRvdyxcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlVGVzdFJ1bkZyb21TdGF0ZSxcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlRml4dHVyZUN0eHNGcm9tU3RhdGUsXG4gICAgICAgICAgICB0aGlzLnJlbW92ZVVuaXRzRnJvbVN0YXRlLFxuICAgICAgICBdLCB0aGlzKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIF9zZXR1cERlYnVnZ2VySGFuZGxlcnMgKCk6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMuY2RwKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRlc3RSdW5UcmFja2VyLm9uKERFQlVHX0FDVElPTi5yZXN1bWUsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jZHApXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCBkaXNhYmxlRGVidWdNZXRob2ROYW1lID0gVGVzdENvbnRyb2xsZXIuZGlzYWJsZURlYnVnRm9yTm9uRGVidWdDb21tYW5kcy5uYW1lO1xuXG4gICAgICAgICAgICAvLyBOT1RFOiBkaXNhYmxlIGBkZWJ1Z2dlcmAgZm9yIG5vbi1kZWJ1ZyBjb21tYW5kcyBpZiB0aGUgYFJlc3VtZWAgYnV0dG9uIGlzIGNsaWNrZWRcbiAgICAgICAgICAgIC8vIHRoZSBgaW5jbHVkZUNvbW1hbmRMaW5lQVBJYCBvcHRpb24gYWxsb3dzIHRvIHVzZSB0aGUgYHJlcXVpcmVgIGZ1bmN0b2lvbiBpbiB0aGUgZXhwcmVzc2lvblxuICAgICAgICAgICAgLy8gVE9ETzogZGVidWdnaW5nOiByZWZhY3RvciB0byB1c2UgYWJzb2x1dGUgcGF0aHNcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuY2RwLlJ1bnRpbWUuZXZhbHVhdGUoe1xuICAgICAgICAgICAgICAgIGV4cHJlc3Npb246ICAgICAgICAgICAgYHJlcXVpcmUubWFpbi5yZXF1aXJlKCcuLi8uLi9hcGkvdGVzdC1jb250cm9sbGVyJykuJHtkaXNhYmxlRGVidWdNZXRob2ROYW1lfSgpYCxcbiAgICAgICAgICAgICAgICBpbmNsdWRlQ29tbWFuZExpbmVBUEk6IHRydWUsXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgYXdhaXQgdGhpcy5jZHAuRGVidWdnZXIucmVzdW1lKHsgdGVybWluYXRlT25SZXN1bWU6IGZhbHNlIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICB0ZXN0UnVuVHJhY2tlci5vbihERUJVR19BQ1RJT04uc3RlcCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmNkcClcbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIGNvbnN0IGVuYWJsZURlYnVnTWV0aG9kTmFtZSA9IFRlc3RDb250cm9sbGVyLmVuYWJsZURlYnVnRm9yTm9uRGVidWdDb21tYW5kcy5uYW1lO1xuXG4gICAgICAgICAgICAvLyBOT1RFOiBlbmFibGUgYGRlYnVnZ2VyYCBmb3Igbm9uLWRlYnVnIGNvbW1hbmRzIGluIHRoZSBgTmV4dCBBY3Rpb25gIGJ1dHRvbiBpcyBjbGlja2VkXG4gICAgICAgICAgICAvLyB0aGUgYGluY2x1ZGVDb21tYW5kTGluZUFQSWAgb3B0aW9uIGFsbG93cyB0byB1c2UgdGhlIGByZXF1aXJlYCBmdW5jdG9pb24gaW4gdGhlIGV4cHJlc3Npb25cbiAgICAgICAgICAgIC8vIFRPRE86IGRlYnVnZ2luZzogcmVmYWN0b3IgdG8gdXNlIGFic29sdXRlIHBhdGhzXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmNkcC5SdW50aW1lLmV2YWx1YXRlKHtcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uOiAgICAgICAgICAgIGByZXF1aXJlLm1haW4ucmVxdWlyZSgnLi4vLi4vYXBpL3Rlc3QtY29udHJvbGxlcicpLiR7ZW5hYmxlRGVidWdNZXRob2ROYW1lfSgpYCxcbiAgICAgICAgICAgICAgICBpbmNsdWRlQ29tbWFuZExpbmVBUEk6IHRydWUsXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgYXdhaXQgdGhpcy5jZHAuRGVidWdnZXIucmVzdW1lKHsgdGVybWluYXRlT25SZXN1bWU6IGZhbHNlIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBOT1RFOiBuZWVkIHRvIHN0ZXAgb3V0IGZyb20gdGhlIHNvdXJjZSBjb2RlIHVudGlsIGJyZWFrcG9pbnQgaXMgc2V0IGluIHRoZSBjb2RlIG9mIHRlc3RcbiAgICAgICAgLy8gZm9yY2UgRGVidWdDb21tYW5kIGlmIGJyZWFrcG9pbnQgc3RvcHBlZCBpbiB0aGUgdGVzdCBjb2RlXG4gICAgICAgIC8vIFRPRE86IGRlYnVnZ2luZzogcmVmYWN0b3IgdG8gdGhpcy5jZHAuRGVidWdnZXIub24oJ3BhdXNlZCcpIGFmdGVyIHVwZGF0aW5nIHRvIGNocm9tZS1yZW1vdGUtaW50ZXJmYWNlQDAuMzAuMFxuICAgICAgICB0aGlzLmNkcC5vbignRGVidWdnZXIucGF1c2VkJywgKGFyZ3M6IGFueSk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICAgICAgY29uc3QgeyBjYWxsRnJhbWVzIH0gPSBhcmdzO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5jZHApIHtcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5yZWFzb24gPT09IElOSVRJQUxfREVCVUdHRVJfQlJFQUtfT05fU1RBUlQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNkcC5EZWJ1Z2dlci5yZXN1bWUoeyB0ZXJtaW5hdGVPblJlc3VtZTogZmFsc2UgfSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoY2FsbEZyYW1lc1swXS51cmwuaW5jbHVkZXMoSU5URVJOQUxfRklMRVNfVVJMKSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuY2RwLkRlYnVnZ2VyLnN0ZXBPdXQoKTtcblxuICAgICAgICAgICAgICAgIE9iamVjdC52YWx1ZXModGVzdFJ1blRyYWNrZXIuYWN0aXZlVGVzdFJ1bnMpLmZvckVhY2godGVzdFJ1biA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGVzdFJ1bi5kZWJ1Z2dpbmcpXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXN0UnVuLmV4ZWN1dGVDb21tYW5kKG5ldyBEZWJ1Z0NvbW1hbmQoKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gTk9URTogbmVlZCB0byBoaWRlIFN0YXR1cyBCYXIgaWYgZGVidWdnZXIgaXMgcmVzdW1lZFxuICAgICAgICAvLyBUT0RPOiBkZWJ1Z2dpbmc6IHJlZmFjdG9yIHRvIHRoaXMuY2RwLkRlYnVnZ2VyLm9uKCdyZXN1bWVkJykgYWZ0ZXIgdXBkYXRpbmcgdG8gY2hyb21lLXJlbW90ZS1pbnRlcmZhY2VAMC4zMC4wXG4gICAgICAgIHRoaXMuY2RwLm9uKCdEZWJ1Z2dlci5yZXN1bWVkJywgKCkgPT4ge1xuICAgICAgICAgICAgT2JqZWN0LnZhbHVlcyh0ZXN0UnVuVHJhY2tlci5hY3RpdmVUZXN0UnVucykuZm9yRWFjaCh0ZXN0UnVuID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGVzdFJ1bi5kZWJ1Z2dpbmcpXG4gICAgICAgICAgICAgICAgICAgIHRlc3RSdW4uZXhlY3V0ZUNvbW1hbmQobmV3IERpc2FibGVEZWJ1Z0NvbW1hbmQoKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBwYXJzZURlYnVnUG9ydCAoKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGlmICh0aGlzLnY4RmxhZ3MpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy52OEZsYWdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSB0aGlzLnY4RmxhZ3NbaV0ubWF0Y2goSU5TUEVDVF9QT1JUX1JFKTtcblxuICAgICAgICAgICAgICAgIGlmIChtYXRjaClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1hdGNoWzNdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfZ2V0U2VydmljZVByb2Nlc3NBcmdzIChwb3J0OiBzdHJpbmcpOiBzdHJpbmcgW10ge1xuICAgICAgICBsZXQgYXJnczogc3RyaW5nW10gPSBbXTtcblxuICAgICAgICBpZiAodGhpcy52OEZsYWdzKVxuICAgICAgICAgICAgYXJncyA9IHRoaXMudjhGbGFncy5maWx0ZXIoZmxhZyA9PiAhSU5TUEVDVF9SRS50ZXN0KGZsYWcpKTtcblxuICAgICAgICAvLyBUT0RPOiBkZWJ1Z2dpbmc6IHJlZmFjdG9yIHRvIGEgc2VwYXJhdGUgZGVidWcgaW5mbyBwYXJzaW5nIHVuaXRcbiAgICAgICAgY29uc3QgaW5zcGVjdEJya0ZsYWcgPSBgLS1pbnNwZWN0LWJyaz0xMjcuMC4wLjE6JHtwb3J0fWA7XG5cbiAgICAgICAgYXJncy5wdXNoKGluc3BlY3RCcmtGbGFnLCBTRVJWSUNFX1BBVEgpO1xuXG4gICAgICAgIHJldHVybiBhcmdzO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgX2luaXQgKHJ1bnRpbWU6IFByb21pc2U8UnVudGltZVJlc291cmNlc3x1bmRlZmluZWQ+KTogUHJvbWlzZTxSdW50aW1lUmVzb3VyY2VzfHVuZGVmaW5lZD4ge1xuICAgICAgICBjb25zdCByZXNvbHZlZFJ1bnRpbWUgPSBhd2FpdCBydW50aW1lO1xuXG4gICAgICAgIGlmIChyZXNvbHZlZFJ1bnRpbWUpXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZWRSdW50aW1lO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwb3J0ICAgID0gdGhpcy5wYXJzZURlYnVnUG9ydCgpIHx8IGF3YWl0IGdldEZyZWVQb3J0KCk7XG4gICAgICAgICAgICBjb25zdCBhcmdzICAgID0gdGhpcy5fZ2V0U2VydmljZVByb2Nlc3NBcmdzKHBvcnQudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICBjb25zdCBzZXJ2aWNlID0gc3Bhd24ocHJvY2Vzcy5hcmd2MCwgYXJncywgeyBzdGRpbzogWzAsIDEsIDIsICdwaXBlJywgJ3BpcGUnLCAncGlwZSddIH0pO1xuXG4gICAgICAgICAgICAvLyBOT1RFOiBuZWVkIHRvIHdhaXQsIG90aGVyd2lzZSB0aGUgZXJyb3Igd2lsbCBiZSBhdCBgYXdhaXQgY2RwKC4uLilgXG4gICAgICAgICAgICAvLyBUT0RPOiBkZWJ1Z2dpbmc6IHJlZmFjdG9yIHRvIHVzZSBkZWxheSBhbmQgbXVsdGlwbGUgdHJpZXNcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAyMDAwKSk7XG5cbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIHRoaXMuY2RwID0gYXdhaXQgY2RwKHsgcG9ydCB9KTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmNkcClcbiAgICAgICAgICAgICAgICByZXR1cm4gdm9pZCAwO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuZGV2ZWxvcG1lbnRNb2RlKVxuICAgICAgICAgICAgICAgIHRoaXMuX3NldHVwRGVidWdnZXJIYW5kbGVycygpO1xuXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmNkcC5EZWJ1Z2dlci5lbmFibGUoe30pO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5jZHAuUnVudGltZS5lbmFibGUoKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuY2RwLlJ1bnRpbWUucnVuSWZXYWl0aW5nRm9yRGVidWdnZXIoKTtcblxuICAgICAgICAgICAgLy8gSEFDSzogTm9kZS5qcyBkZWZpbml0aW9uIGFyZSBub3QgY29ycmVjdCB3aGVuIGFkZGl0aW9uYWwgSS9PIGNoYW5uZWxzIGFyZSBzcFxuICAgICAgICAgICAgY29uc3Qgc3RkaW8gPSBzZXJ2aWNlLnN0ZGlvIGFzIGFueTtcbiAgICAgICAgICAgIGNvbnN0IHByb3h5ID0gbmV3IElQQ1Byb3h5KG5ldyBIb3N0VHJhbnNwb3J0KHN0ZGlvW0hPU1RfSU5QVVRfRkRdLCBzdGRpb1tIT1NUX09VVFBVVF9GRF0sIHN0ZGlvW0hPU1RfU1lOQ19GRF0pKTtcblxuICAgICAgICAgICAgdGhpcy5fc2V0dXBSb3V0ZXMocHJveHkpO1xuXG4gICAgICAgICAgICBhd2FpdCB0aGlzLm9uY2UoJ3JlYWR5Jyk7XG5cbiAgICAgICAgICAgIHJldHVybiB7IHByb3h5LCBzZXJ2aWNlIH07XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJldHVybiB2b2lkIDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIF9nZXRSdW50aW1lICgpOiBQcm9taXNlPFJ1bnRpbWVSZXNvdXJjZXM+IHtcbiAgICAgICAgY29uc3QgcnVudGltZSA9IGF3YWl0IHRoaXMucnVudGltZTtcblxuICAgICAgICBpZiAoIXJ1bnRpbWUpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1J1bnRpbWUgaXMgbm90IGF2YWlsYWJsZS4nKTtcblxuICAgICAgICByZXR1cm4gcnVudGltZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIF9nZXRUYXJnZXRUZXN0UnVuIChpZDogc3RyaW5nKTogVGVzdFJ1biB7XG4gICAgICAgIHJldHVybiB0ZXN0UnVuVHJhY2tlci5hY3RpdmVUZXN0UnVuc1tpZF0gYXMgdW5rbm93biBhcyBUZXN0UnVuO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBpbml0ICgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgdGhpcy5ydW50aW1lID0gdGhpcy5faW5pdCh0aGlzLnJ1bnRpbWUpO1xuXG4gICAgICAgIGF3YWl0IHRoaXMucnVudGltZTtcblxuICAgICAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc3RvcCAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICghdGhpcy5pbml0aWFsaXplZClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCB7IHNlcnZpY2UsIHByb3h5IH0gPSBhd2FpdCB0aGlzLl9nZXRSdW50aW1lKCk7XG5cbiAgICAgICAgc2VydmljZS5raWxsKCk7XG4gICAgICAgIHByb3h5LnN0b3AoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIF93cmFwVGVzdEZ1bmN0aW9uIChpZDogc3RyaW5nLCBmdW5jdGlvbk5hbWU6IEZ1bmN0aW9uUHJvcGVydGllcyk6IFRlc3RGdW5jdGlvbiB7XG4gICAgICAgIHJldHVybiBhc3luYyB0ZXN0UnVuID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucnVuVGVzdEZuKHsgaWQsIGZ1bmN0aW9uTmFtZSwgdGVzdFJ1bklkOiB0ZXN0UnVuLmlkIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVyckxpc3QgPSBuZXcgVGVzdENhZmVFcnJvckxpc3QoKTtcblxuICAgICAgICAgICAgICAgIGVyckxpc3QuYWRkRXJyb3IoZXJyKTtcblxuICAgICAgICAgICAgICAgIHRocm93IGVyckxpc3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfd3JhcFJlcXVlc3RGaWx0ZXJSdWxlUHJlZGljYXRlICh7IHRlc3RJZCwgaG9va0lkLCBydWxlSWQgfTogUmVxdWVzdEZpbHRlclJ1bGVMb2NhdG9yKTogUmVxdWVzdEZpbHRlclJ1bGVQcmVkaWNhdGUge1xuICAgICAgICByZXR1cm4gYXN5bmMgKHJlcXVlc3RJbmZvOiBSZXF1ZXN0SW5mbykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZXhlY3V0ZVJlcXVlc3RGaWx0ZXJSdWxlUHJlZGljYXRlKHsgdGVzdElkLCBob29rSWQsIHJ1bGVJZCwgcmVxdWVzdEluZm8gfSk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfd3JhcE1vY2tQcmVkaWNhdGUgKHsgbW9jaywgdGVzdElkLCBob29rSWQsIHJ1bGVJZCB9OiBXcmFwTW9ja1ByZWRpY2F0ZUFyZ3VtZW50cyk6IHZvaWQge1xuICAgICAgICBtb2NrLmJvZHkgPSBhc3luYyAocmVxdWVzdEluZm86IFJlcXVlc3RJbmZvLCByZXM6IEluY29taW5nTWVzc2FnZUxpa2VJbml0T3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZXhlY3V0ZU1vY2tQcmVkaWNhdGUoeyB0ZXN0SWQsIGhvb2tJZCwgcnVsZUlkLCByZXF1ZXN0SW5mbywgcmVzIH0pO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgX2dldEVycm9yVHlwZUNvbnN0cnVjdG9yICh0eXBlOiBzdHJpbmcpOiBGdW5jdGlvbiB7XG4gICAgICAgIHJldHVybiBlcnJvclR5cGVDb25zdHJ1Y3RvcnMuZ2V0KHR5cGUpIGFzIEZ1bmN0aW9uO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyByZWFkeSAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRoaXMuZW1pdCgncmVhZHknKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZXhlY3V0ZUNvbW1hbmRTeW5jICgpOiBuZXZlciB7XG4gICAgICAgIHRocm93IG5ldyBNZXRob2RTaG91bGROb3RCZUNhbGxlZEVycm9yKCk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGV4ZWN1dGVDb21tYW5kICh7IGNvbW1hbmQsIGlkLCBjYWxsc2l0ZSB9OiBFeGVjdXRlQ29tbWFuZEFyZ3VtZW50cyk6IFByb21pc2U8dW5rbm93bj4ge1xuICAgICAgICByZXR1cm4gdGhpc1xuICAgICAgICAgICAgLl9nZXRUYXJnZXRUZXN0UnVuKGlkKVxuICAgICAgICAgICAgLmV4ZWN1dGVDb21tYW5kKGNvbW1hbmQsIGNhbGxzaXRlKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0VGVzdHMgKHsgc291cmNlTGlzdCwgY29tcGlsZXJPcHRpb25zLCBydW5uYWJsZUNvbmZpZ3VyYXRpb25JZCB9OiBDb21waWxlckFyZ3VtZW50cywgYmFzZVVybD86IHN0cmluZyk6IFByb21pc2U8VGVzdFtdPiB7XG4gICAgICAgIGNvbnN0IHsgcHJveHkgfSA9IGF3YWl0IHRoaXMuX2dldFJ1bnRpbWUoKTtcblxuICAgICAgICBjb25zdCB1bml0cyA9IGF3YWl0IHByb3h5LmNhbGwodGhpcy5nZXRUZXN0cywgeyBzb3VyY2VMaXN0LCBjb21waWxlck9wdGlvbnMsIHJ1bm5hYmxlQ29uZmlndXJhdGlvbklkIH0sIGJhc2VVcmwpO1xuXG4gICAgICAgIHJldHVybiByZXN0b3JlVGVzdFN0cnVjdHVyZShcbiAgICAgICAgICAgIHVuaXRzLFxuICAgICAgICAgICAgKC4uLmFyZ3MpID0+IHRoaXMuX3dyYXBUZXN0RnVuY3Rpb24oLi4uYXJncyksXG4gICAgICAgICAgICAocnVsZUxvY2F0b3I6IFJlcXVlc3RGaWx0ZXJSdWxlTG9jYXRvcikgPT4gdGhpcy5fd3JhcFJlcXVlc3RGaWx0ZXJSdWxlUHJlZGljYXRlKHJ1bGVMb2NhdG9yKVxuICAgICAgICApO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBydW5UZXN0Rm4gKHsgaWQsIGZ1bmN0aW9uTmFtZSwgdGVzdFJ1bklkIH06IFJ1blRlc3RBcmd1bWVudHMpOiBQcm9taXNlPHVua25vd24+IHtcbiAgICAgICAgY29uc3QgeyBwcm94eSB9ID0gYXdhaXQgdGhpcy5fZ2V0UnVudGltZSgpO1xuXG4gICAgICAgIHJldHVybiBhd2FpdCBwcm94eS5jYWxsKHRoaXMucnVuVGVzdEZuLCB7IGlkLCBmdW5jdGlvbk5hbWUsIHRlc3RSdW5JZCB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgY2xlYW5VcCAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IHsgcHJveHkgfSA9IGF3YWl0IHRoaXMuX2dldFJ1bnRpbWUoKTtcblxuICAgICAgICBhd2FpdCBwcm94eS5jYWxsKHRoaXMuY2xlYW5VcCk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNldFVzZXJWYXJpYWJsZXMgKHVzZXJWYXJpYWJsZXM6IFVzZXJWYXJpYWJsZXMgfCBudWxsKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IHsgcHJveHkgfSA9IGF3YWl0IHRoaXMuX2dldFJ1bnRpbWUoKTtcblxuICAgICAgICBhd2FpdCBwcm94eS5jYWxsKHRoaXMuc2V0VXNlclZhcmlhYmxlcywgdXNlclZhcmlhYmxlcyk7XG4gICAgfVxuXG5cbiAgICBwdWJsaWMgYXN5bmMgc2V0T3B0aW9ucyAoeyB2YWx1ZSB9OiBTZXRPcHRpb25zQXJndW1lbnRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IHsgcHJveHkgfSA9IGF3YWl0IHRoaXMuX2dldFJ1bnRpbWUoKTtcblxuICAgICAgICBjb25zdCBwcmVwYXJlZE9wdGlvbnMgPSBwcmVwYXJlT3B0aW9ucyh2YWx1ZSk7XG5cbiAgICAgICAgYXdhaXQgcHJveHkuY2FsbCh0aGlzLnNldE9wdGlvbnMsIHsgdmFsdWU6IHByZXBhcmVkT3B0aW9ucyB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgb25SZXF1ZXN0SG9va0V2ZW50ICh7IG5hbWUsIHRlc3RJZCwgaG9va0lkLCBldmVudERhdGEgfTogUmVxdWVzdEhvb2tFdmVudEFyZ3VtZW50cyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB7IHByb3h5IH0gPSBhd2FpdCB0aGlzLl9nZXRSdW50aW1lKCk7XG5cbiAgICAgICAgYXdhaXQgcHJveHkuY2FsbCh0aGlzLm9uUmVxdWVzdEhvb2tFdmVudCwge1xuICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgIHRlc3RJZCxcbiAgICAgICAgICAgIGhvb2tJZCxcbiAgICAgICAgICAgIGV2ZW50RGF0YSxcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNldE1vY2sgKHsgdGVzdElkLCBob29rSWQsIHJ1bGVJZCwgcmVzcG9uc2VFdmVudElkLCBtb2NrIH06IFNldE1vY2tBcmd1bWVudHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKG1vY2suaXNQcmVkaWNhdGUpXG4gICAgICAgICAgICB0aGlzLl93cmFwTW9ja1ByZWRpY2F0ZSh7IG1vY2ssIHRlc3RJZCwgaG9va0lkLCBydWxlSWQgfSk7XG5cbiAgICAgICAgYXdhaXQgdGhpcy5lbWl0KCdzZXRNb2NrJywgW3Jlc3BvbnNlRXZlbnRJZCwgbW9ja10pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzZXRDb25maWd1cmVSZXNwb25zZUV2ZW50T3B0aW9ucyAoeyBldmVudElkLCBvcHRzIH06IFNldENvbmZpZ3VyZVJlc3BvbnNlRXZlbnRPcHRpb25zQXJndW1lbnRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGF3YWl0IHRoaXMuZW1pdCgnc2V0Q29uZmlndXJlUmVzcG9uc2VFdmVudE9wdGlvbnMnLCBbZXZlbnRJZCwgb3B0c10pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzZXRIZWFkZXJPbkNvbmZpZ3VyZVJlc3BvbnNlRXZlbnQgKHsgZXZlbnRJZCwgaGVhZGVyTmFtZSwgaGVhZGVyVmFsdWUgfTogU2V0SGVhZGVyT25Db25maWd1cmVSZXNwb25zZUV2ZW50QXJndW1lbnRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGF3YWl0IHRoaXMuZW1pdCgnc2V0SGVhZGVyT25Db25maWd1cmVSZXNwb25zZUV2ZW50JywgW2V2ZW50SWQsIGhlYWRlck5hbWUsIGhlYWRlclZhbHVlXSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHJlbW92ZUhlYWRlck9uQ29uZmlndXJlUmVzcG9uc2VFdmVudCAoeyBldmVudElkLCBoZWFkZXJOYW1lIH06IFJlbW92ZUhlYWRlck9uQ29uZmlndXJlUmVzcG9uc2VFdmVudEFyZ3VtZW50cyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBhd2FpdCB0aGlzLmVtaXQoJ3JlbW92ZUhlYWRlck9uQ29uZmlndXJlUmVzcG9uc2VFdmVudCcsIFtldmVudElkLCBoZWFkZXJOYW1lXSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGV4ZWN1dGVSZXF1ZXN0RmlsdGVyUnVsZVByZWRpY2F0ZSAoeyB0ZXN0SWQsIGhvb2tJZCwgcnVsZUlkLCByZXF1ZXN0SW5mbyB9OiBFeGVjdXRlUmVxdWVzdEZpbHRlclJ1bGVQcmVkaWNhdGVBcmd1bWVudHMpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgY29uc3QgeyBwcm94eSB9ID0gYXdhaXQgdGhpcy5fZ2V0UnVudGltZSgpO1xuXG4gICAgICAgIHJldHVybiBhd2FpdCBwcm94eS5jYWxsKHRoaXMuZXhlY3V0ZVJlcXVlc3RGaWx0ZXJSdWxlUHJlZGljYXRlLCB7IHRlc3RJZCwgaG9va0lkLCBydWxlSWQsIHJlcXVlc3RJbmZvIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBleGVjdXRlTW9ja1ByZWRpY2F0ZSAoeyB0ZXN0SWQsIGhvb2tJZCwgcnVsZUlkLCByZXF1ZXN0SW5mbywgcmVzIH06IEV4ZWN1dGVNb2NrUHJlZGljYXRlKTogUHJvbWlzZTxJbmNvbWluZ01lc3NhZ2VMaWtlSW5pdE9wdGlvbnM+IHtcbiAgICAgICAgY29uc3QgeyBwcm94eSB9ID0gYXdhaXQgdGhpcy5fZ2V0UnVudGltZSgpO1xuXG4gICAgICAgIHJldHVybiBhd2FpdCBwcm94eS5jYWxsKHRoaXMuZXhlY3V0ZU1vY2tQcmVkaWNhdGUsIHsgdGVzdElkLCBob29rSWQsIHJ1bGVJZCwgcmVxdWVzdEluZm8sIHJlcyB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0V2FybmluZ01lc3NhZ2VzICh7IHRlc3RSdW5JZCB9OiBUZXN0UnVuTG9jYXRvcik6IFByb21pc2U8V2FybmluZ0xvZ01lc3NhZ2VbXT4ge1xuICAgICAgICBjb25zdCB7IHByb3h5IH0gPSBhd2FpdCB0aGlzLl9nZXRSdW50aW1lKCk7XG5cbiAgICAgICAgcmV0dXJuIHByb3h5LmNhbGwodGhpcy5nZXRXYXJuaW5nTWVzc2FnZXMsIHsgdGVzdFJ1bklkIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBhZGRSZXF1ZXN0RXZlbnRMaXN0ZW5lcnMgKCB7IGhvb2tJZCwgaG9va0NsYXNzTmFtZSwgcnVsZXMgfTogQWRkUmVxdWVzdEV2ZW50TGlzdGVuZXJzQXJndW1lbnRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGF3YWl0IHRoaXMuZW1pdCgnYWRkUmVxdWVzdEV2ZW50TGlzdGVuZXJzJywgeyBob29rSWQsIGhvb2tDbGFzc05hbWUsIHJ1bGVzIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyByZW1vdmVSZXF1ZXN0RXZlbnRMaXN0ZW5lcnMgKHsgcnVsZXMgfTogUmVtb3ZlUmVxdWVzdEV2ZW50TGlzdGVuZXJzQXJndW1lbnRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGF3YWl0IHRoaXMuZW1pdCgncmVtb3ZlUmVxdWVzdEV2ZW50TGlzdGVuZXJzJywgeyBydWxlcyB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgaW5pdGlhbGl6ZVRlc3RSdW5EYXRhICh7IHRlc3RSdW5JZCwgdGVzdElkLCBicm93c2VyLCBhY3RpdmVXaW5kb3dJZCwgbWVzc2FnZUJ1cyB9OiBJbml0aWFsaXplVGVzdFJ1bkRhdGFBcmd1bWVudHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgeyBwcm94eSB9ID0gYXdhaXQgdGhpcy5fZ2V0UnVudGltZSgpO1xuXG4gICAgICAgIHJldHVybiBwcm94eS5jYWxsKHRoaXMuaW5pdGlhbGl6ZVRlc3RSdW5EYXRhLCB7IHRlc3RSdW5JZCwgdGVzdElkLCBicm93c2VyLCBhY3RpdmVXaW5kb3dJZCwgbWVzc2FnZUJ1cyB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0QXNzZXJ0aW9uQWN0dWFsVmFsdWUgKHsgdGVzdFJ1bklkLCBjb21tYW5kSWQgfTogQ29tbWFuZExvY2F0b3IpOiBQcm9taXNlPHVua25vd24+IHtcbiAgICAgICAgY29uc3QgeyBwcm94eSB9ID0gYXdhaXQgdGhpcy5fZ2V0UnVudGltZSgpO1xuXG4gICAgICAgIHJldHVybiBwcm94eS5jYWxsKHRoaXMuZ2V0QXNzZXJ0aW9uQWN0dWFsVmFsdWUsIHsgdGVzdFJ1bklkLCBjb21tYW5kSWQ6IGNvbW1hbmRJZCB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZXhlY3V0ZVJvbGVJbml0Rm4gKHsgdGVzdFJ1bklkLCByb2xlSWQgfTogRXhlY3V0ZVJvbGVJbml0Rm5Bcmd1bWVudHMpOiBQcm9taXNlPHVua25vd24+IHtcbiAgICAgICAgY29uc3QgeyBwcm94eSB9ID0gYXdhaXQgdGhpcy5fZ2V0UnVudGltZSgpO1xuXG4gICAgICAgIHJldHVybiBwcm94eS5jYWxsKHRoaXMuZXhlY3V0ZVJvbGVJbml0Rm4sIHsgdGVzdFJ1bklkLCByb2xlSWQgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldEN0eCAoeyB0ZXN0UnVuSWQgfTogVGVzdFJ1bkxvY2F0b3IpOiBQcm9taXNlPG9iamVjdD4ge1xuICAgICAgICBjb25zdCB7IHByb3h5IH0gPSBhd2FpdCB0aGlzLl9nZXRSdW50aW1lKCk7XG5cbiAgICAgICAgcmV0dXJuIHByb3h5LmNhbGwodGhpcy5nZXRDdHgsIHsgdGVzdFJ1bklkIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRGaXh0dXJlQ3R4ICh7IHRlc3RSdW5JZCB9OiBUZXN0UnVuTG9jYXRvcik6IFByb21pc2U8b2JqZWN0PiB7XG4gICAgICAgIGNvbnN0IHsgcHJveHkgfSA9IGF3YWl0IHRoaXMuX2dldFJ1bnRpbWUoKTtcblxuICAgICAgICByZXR1cm4gcHJveHkuY2FsbCh0aGlzLmdldEZpeHR1cmVDdHgsIHsgdGVzdFJ1bklkIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzZXRDdHggKHsgdGVzdFJ1bklkLCB2YWx1ZSB9OiBTZXRDdHhBcmd1bWVudHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgeyBwcm94eSB9ID0gYXdhaXQgdGhpcy5fZ2V0UnVudGltZSgpO1xuXG4gICAgICAgIHJldHVybiBwcm94eS5jYWxsKHRoaXMuc2V0Q3R4LCB7IHRlc3RSdW5JZCwgdmFsdWUgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNldEZpeHR1cmVDdHggKHsgdGVzdFJ1bklkLCB2YWx1ZSB9OiBTZXRDdHhBcmd1bWVudHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgeyBwcm94eSB9ID0gYXdhaXQgdGhpcy5fZ2V0UnVudGltZSgpO1xuXG4gICAgICAgIHJldHVybiBwcm94eS5jYWxsKHRoaXMuc2V0Rml4dHVyZUN0eCwgeyB0ZXN0UnVuSWQsIHZhbHVlIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBvblJvbGVBcHBlYXJlZCAoKTogdm9pZCB7XG4gICAgICAgIHRocm93IG5ldyBNZXRob2RTaG91bGROb3RCZUNhbGxlZEVycm9yKCk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHVwZGF0ZVJvbGVQcm9wZXJ0eSAoeyByb2xlSWQsIG5hbWUsIHZhbHVlIH06IFVwZGF0ZVJvbGVQcm9wZXJ0eUFyZ3VtZW50cyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB7IHByb3h5IH0gPSBhd2FpdCB0aGlzLl9nZXRSdW50aW1lKCk7XG5cbiAgICAgICAgcmV0dXJuIHByb3h5LmNhbGwodGhpcy51cGRhdGVSb2xlUHJvcGVydHksIHsgcm9sZUlkLCBuYW1lLCB2YWx1ZSB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZXhlY3V0ZUpzRXhwcmVzc2lvbiAoeyBleHByZXNzaW9uLCB0ZXN0UnVuSWQsIG9wdGlvbnMgfTogRXhlY3V0ZUpzRXhwcmVzc2lvbkFyZ3VtZW50cyk6IFByb21pc2U8dW5rbm93bj4ge1xuICAgICAgICBjb25zdCB7IHByb3h5IH0gPSBhd2FpdCB0aGlzLl9nZXRSdW50aW1lKCk7XG5cbiAgICAgICAgcmV0dXJuIHByb3h5LmNhbGwodGhpcy5leGVjdXRlSnNFeHByZXNzaW9uLCB7IGV4cHJlc3Npb24sIHRlc3RSdW5JZCwgb3B0aW9ucyB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZXhlY3V0ZUFzeW5jSnNFeHByZXNzaW9uICh7IGV4cHJlc3Npb24sIHRlc3RSdW5JZCwgY2FsbHNpdGUgfTogRXhlY3V0ZUFzeW5jSnNFeHByZXNzaW9uQXJndW1lbnRzKTogUHJvbWlzZTx1bmtub3duPiB7XG4gICAgICAgIGNvbnN0IHsgcHJveHkgfSA9IGF3YWl0IHRoaXMuX2dldFJ1bnRpbWUoKTtcblxuICAgICAgICByZXR1cm4gcHJveHkuY2FsbCh0aGlzLmV4ZWN1dGVBc3luY0pzRXhwcmVzc2lvbiwgeyBleHByZXNzaW9uLCB0ZXN0UnVuSWQsIGNhbGxzaXRlIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBleGVjdXRlQXNzZXJ0aW9uRm4gKHsgdGVzdFJ1bklkLCBjb21tYW5kSWQgfTogQ29tbWFuZExvY2F0b3IpOiBQcm9taXNlPHVua25vd24+IHtcbiAgICAgICAgY29uc3QgeyBwcm94eSB9ID0gYXdhaXQgdGhpcy5fZ2V0UnVudGltZSgpO1xuXG4gICAgICAgIHJldHVybiBwcm94eS5jYWxsKHRoaXMuZXhlY3V0ZUFzc2VydGlvbkZuLCB7IHRlc3RSdW5JZCwgY29tbWFuZElkIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBhZGRVbmV4cGVjdGVkRXJyb3IgKHsgdHlwZSwgbWVzc2FnZSB9OiBBZGRVbmV4cGVjdGVkRXJyb3JBcmd1bWVudHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgRXJyb3JUeXBlQ29uc3RydWN0b3IgPSB0aGlzLl9nZXRFcnJvclR5cGVDb25zdHJ1Y3Rvcih0eXBlKTtcblxuICAgICAgICBoYW5kbGVVbmV4cGVjdGVkRXJyb3IoRXJyb3JUeXBlQ29uc3RydWN0b3IsIG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBjaGVja1dpbmRvdyAoeyB0ZXN0UnVuSWQsIGNvbW1hbmRJZCwgdXJsLCB0aXRsZSB9OiBDaGVja1dpbmRvd0FyZ3VtZW50KTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIGNvbnN0IHsgcHJveHkgfSA9IGF3YWl0IHRoaXMuX2dldFJ1bnRpbWUoKTtcblxuICAgICAgICByZXR1cm4gcHJveHkuY2FsbCh0aGlzLmNoZWNrV2luZG93LCB7IHRlc3RSdW5JZCwgY29tbWFuZElkLCB1cmwsIHRpdGxlIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyByZW1vdmVUZXN0UnVuRnJvbVN0YXRlICh7IHRlc3RSdW5JZCB9OiBUZXN0UnVuTG9jYXRvcik6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB7IHByb3h5IH0gPSBhd2FpdCB0aGlzLl9nZXRSdW50aW1lKCk7XG5cbiAgICAgICAgcmV0dXJuIHByb3h5LmNhbGwodGhpcy5yZW1vdmVUZXN0UnVuRnJvbVN0YXRlLCB7IHRlc3RSdW5JZCB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgcmVtb3ZlRml4dHVyZUN0eHNGcm9tU3RhdGUgKHsgZml4dHVyZUlkcyB9OiBSZW1vdmVGaXh0dXJlQ3R4c0FyZ3VtZW50cyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB7IHByb3h5IH0gPSBhd2FpdCB0aGlzLl9nZXRSdW50aW1lKCk7XG5cbiAgICAgICAgcmV0dXJuIHByb3h5LmNhbGwodGhpcy5yZW1vdmVGaXh0dXJlQ3R4c0Zyb21TdGF0ZSwgeyBmaXh0dXJlSWRzIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyByZW1vdmVVbml0c0Zyb21TdGF0ZSAoeyBydW5uYWJsZUNvbmZpZ3VyYXRpb25JZCB9OiBSZW1vdmVVbml0c0Zyb21TdGF0ZUFyZ3VtZW50cyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB7IHByb3h5IH0gPSBhd2FpdCB0aGlzLl9nZXRSdW50aW1lKCk7XG5cbiAgICAgICAgcmV0dXJuIHByb3h5LmNhbGwodGhpcy5yZW1vdmVVbml0c0Zyb21TdGF0ZSwgeyBydW5uYWJsZUNvbmZpZ3VyYXRpb25JZCB9KTtcbiAgICB9XG59XG4iXX0=