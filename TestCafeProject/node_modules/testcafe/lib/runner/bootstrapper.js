"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const debug_1 = __importDefault(require("debug"));
const pretty_hrtime_1 = __importDefault(require("pretty-hrtime"));
const compiler_1 = __importDefault(require("../compiler"));
const connection_1 = __importDefault(require("../browser/connection"));
const browser_set_1 = __importDefault(require("./browser-set"));
const runtime_1 = require("../errors/runtime");
const types_1 = require("../errors/types");
const tested_app_1 = __importDefault(require("./tested-app"));
const parse_file_list_1 = __importDefault(require("../utils/parse-file-list"));
const load_1 = __importDefault(require("../custom-client-scripts/load"));
const string_1 = require("../utils/string");
const warning_log_1 = __importDefault(require("../notifications/warning-log"));
const warning_message_1 = __importDefault(require("../notifications/warning-message"));
const guard_time_execution_1 = __importDefault(require("../utils/guard-time-execution"));
const async_filter_1 = __importDefault(require("../utils/async-filter"));
const wrap_test_function_1 = __importDefault(require("../api/wrap-test-function"));
const type_assertions_1 = require("../errors/runtime/type-assertions");
const testcafe_hammerhead_1 = require("testcafe-hammerhead");
const assert_type_1 = __importDefault(require("../api/request-hooks/assert-type"));
const user_variables_1 = __importDefault(require("../api/user-variables"));
const option_names_1 = __importDefault(require("../configuration/option-names"));
const DEBUG_SCOPE = 'testcafe:bootstrapper';
function isPromiseError(value) {
    return value.error !== void 0;
}
class Bootstrapper {
    constructor({ browserConnectionGateway, compilerService, messageBus, configuration }) {
        this.browserConnectionGateway = browserConnectionGateway;
        this.concurrency = 1;
        this.sources = [];
        this.browsers = [];
        this.reporters = [];
        this.filter = void 0;
        this.appCommand = void 0;
        this.appInitDelay = void 0;
        this.tsConfigPath = void 0;
        this.clientScripts = [];
        this.disableMultipleWindows = false;
        this.proxyless = false;
        this.compilerOptions = void 0;
        this.debugLogger = (0, debug_1.default)(DEBUG_SCOPE);
        this.warningLog = new warning_log_1.default(null, warning_log_1.default.createAddWarningCallback(messageBus));
        this.compilerService = compilerService;
        this.messageBus = messageBus;
        this.configuration = configuration;
        this.TESTS_COMPILATION_UPPERBOUND = 60;
    }
    static _getBrowserName(browser) {
        if (browser instanceof connection_1.default)
            return browser.browserInfo.browserName;
        return browser.browserName;
    }
    static _splitBrowserInfo(browserInfo) {
        const remotes = [];
        const automated = [];
        browserInfo.forEach(browser => {
            if (browser instanceof connection_1.default)
                remotes.push(browser);
            else
                automated.push(browser);
        });
        return { remotes, automated };
    }
    _createAutomatedConnections(browserInfo) {
        if (!browserInfo)
            return [];
        return browserInfo
            .map(browser => (0, lodash_1.times)(this.concurrency, () => new connection_1.default(this.browserConnectionGateway, Object.assign({}, browser), false, this.disableMultipleWindows, this.proxyless, this.messageBus)));
    }
    _getBrowserSetOptions() {
        return {
            concurrency: this.concurrency,
            browserInitTimeout: this.browserInitTimeout,
            warningLog: this.warningLog,
        };
    }
    async _getBrowserConnections(browserInfo) {
        const { automated, remotes } = Bootstrapper._splitBrowserInfo(browserInfo);
        if (remotes && remotes.length % this.concurrency)
            throw new runtime_1.GeneralError(types_1.RUNTIME_ERRORS.cannotDivideRemotesCountByConcurrency);
        let browserConnections = this._createAutomatedConnections(automated);
        remotes.forEach(remoteConnection => {
            remoteConnection.messageBus = this.messageBus;
        });
        browserConnections = browserConnections.concat((0, lodash_1.chunk)(remotes, this.concurrency));
        return browser_set_1.default.from(browserConnections, this._getBrowserSetOptions());
    }
    async _filterTests(tests, predicate) {
        return (0, async_filter_1.default)(tests, test => {
            const testFixture = test.fixture;
            return predicate(test.name, testFixture.name, testFixture.path, test.meta, testFixture.meta);
        });
    }
    async _compileTests({ sourceList, compilerOptions, runnableConfigurationId }) {
        const baseUrl = this.configuration.getOption(option_names_1.default.baseUrl);
        if (this.compilerService) {
            await this.compilerService.init();
            await this.compilerService.setUserVariables(user_variables_1.default.value);
            return this.compilerService.getTests({ sourceList, compilerOptions, runnableConfigurationId }, baseUrl);
        }
        const compiler = new compiler_1.default(sourceList, compilerOptions, { baseUrl, isCompilerServiceMode: false });
        return compiler.getTests();
    }
    _assertGlobalHooks() {
        var _a, _b, _c, _d;
        if (!this.hooks)
            return;
        if ((_a = this.hooks.fixture) === null || _a === void 0 ? void 0 : _a.before)
            (0, type_assertions_1.assertType)(type_assertions_1.is.function, 'globalBefore', 'The fixture.globalBefore hook', this.hooks.fixture.before);
        if ((_b = this.hooks.fixture) === null || _b === void 0 ? void 0 : _b.after)
            (0, type_assertions_1.assertType)(type_assertions_1.is.function, 'globalAfter', 'The fixture.globalAfter hook', this.hooks.fixture.after);
        if ((_c = this.hooks.test) === null || _c === void 0 ? void 0 : _c.before)
            (0, type_assertions_1.assertType)(type_assertions_1.is.function, 'globalBefore', 'The test.globalBefore hook', this.hooks.test.before);
        if ((_d = this.hooks.test) === null || _d === void 0 ? void 0 : _d.after)
            (0, type_assertions_1.assertType)(type_assertions_1.is.function, 'globalAfter', 'The test.globalAfter hook', this.hooks.test.after);
        if (this.hooks.request)
            (0, assert_type_1.default)((0, lodash_1.flattenDeep)((0, lodash_1.castArray)(this.hooks.request)));
    }
    _setGlobalHooksToTests(tests) {
        var _a, _b, _c, _d;
        if (!this.hooks)
            return;
        this._assertGlobalHooks();
        const fixtureBefore = ((_a = this.hooks.fixture) === null || _a === void 0 ? void 0 : _a.before) || null;
        const fixtureAfter = ((_b = this.hooks.fixture) === null || _b === void 0 ? void 0 : _b.after) || null;
        const testBefore = ((_c = this.hooks.test) === null || _c === void 0 ? void 0 : _c.before) ? (0, wrap_test_function_1.default)(this.hooks.test.before) : null;
        const testAfter = ((_d = this.hooks.test) === null || _d === void 0 ? void 0 : _d.after) ? (0, wrap_test_function_1.default)(this.hooks.test.after) : null;
        const request = this.hooks.request || [];
        tests.forEach(item => {
            if (item.fixture) {
                item.fixture.globalBeforeFn = item.fixture.globalBeforeFn || fixtureBefore;
                item.fixture.globalAfterFn = item.fixture.globalAfterFn || fixtureAfter;
            }
            item.globalBeforeFn = testBefore;
            item.globalAfterFn = testAfter;
            item.requestHooks = (0, lodash_1.union)((0, lodash_1.flattenDeep)((0, lodash_1.castArray)(request)), item.requestHooks);
        });
    }
    async _getTests(id) {
        const cwd = process.cwd();
        const sourceList = await (0, parse_file_list_1.default)(this.sources, cwd);
        if (!sourceList.length)
            throw new runtime_1.GeneralError(types_1.RUNTIME_ERRORS.testFilesNotFound, cwd, (0, string_1.getConcatenatedValuesString)(this.sources, '\n', ''));
        let tests = await (0, guard_time_execution_1.default)(async () => await this._compileTests({ sourceList, compilerOptions: this.compilerOptions, runnableConfigurationId: id }), elapsedTime => {
            this.debugLogger(`tests compilation took ${(0, pretty_hrtime_1.default)(elapsedTime)}`);
            const [elapsedSeconds] = elapsedTime;
            if (elapsedSeconds > this.TESTS_COMPILATION_UPPERBOUND)
                this.warningLog.addWarning(warning_message_1.default.testsCompilationTakesTooLong, (0, pretty_hrtime_1.default)(elapsedTime));
        });
        const testsWithOnlyFlag = tests.filter(test => test.only);
        if (testsWithOnlyFlag.length)
            tests = testsWithOnlyFlag;
        if (!tests.length)
            throw new runtime_1.GeneralError(types_1.RUNTIME_ERRORS.noTestsToRun);
        if (this.filter)
            tests = await this._filterTests(tests, this.filter);
        if (!tests.length)
            throw new runtime_1.GeneralError(types_1.RUNTIME_ERRORS.noTestsToRunDueFiltering);
        this._setGlobalHooksToTests(tests);
        return tests;
    }
    async _startTestedApp() {
        if (!this.appCommand)
            return void 0;
        const testedApp = new tested_app_1.default();
        await testedApp.start(this.appCommand, this.appInitDelay);
        return testedApp;
    }
    async _canUseParallelBootstrapping(browserInfo) {
        const isLocalPromises = browserInfo.map(browser => browser.provider.isLocalBrowser(void 0, Bootstrapper._getBrowserName(browser)));
        const isLocalBrowsers = await Promise.all(isLocalPromises);
        return isLocalBrowsers.every(result => result);
    }
    async _bootstrapSequence(browserInfo, id) {
        const tests = await this._getTests(id);
        const testedApp = await this._startTestedApp();
        const browserSet = await this._getBrowserConnections(browserInfo);
        return { tests, testedApp, browserSet };
    }
    _wrapBootstrappingPromise(promise) {
        return promise
            .then(result => ({ error: void 0, result }))
            .catch(error => ({ result: void 0, error }));
    }
    async _getBootstrappingError(browserSetStatus, testsStatus, testedAppStatus) {
        if (!isPromiseError(browserSetStatus))
            await browserSetStatus.result.dispose();
        if (!isPromiseError(browserSetStatus) && !isPromiseError(testedAppStatus) && testedAppStatus.result)
            await testedAppStatus.result.kill();
        if (isPromiseError(testsStatus))
            return testsStatus.error;
        if (isPromiseError(testedAppStatus))
            return testedAppStatus.error;
        if (isPromiseError(browserSetStatus))
            return browserSetStatus.error;
        return new Error('Unexpected call');
    }
    _getBootstrappingPromises(arg) {
        const result = {};
        for (const k in arg)
            result[k] = this._wrapBootstrappingPromise(arg[k]);
        return result;
    }
    async _bootstrapParallel(browserInfo, id) {
        const bootstrappingPromises = {
            browserSet: this._getBrowserConnections(browserInfo),
            tests: this._getTests(id),
            app: this._startTestedApp(),
        };
        const bootstrappingResultPromises = this._getBootstrappingPromises(bootstrappingPromises);
        const bootstrappingResults = await Promise.all([
            bootstrappingResultPromises.browserSet,
            bootstrappingResultPromises.tests,
            bootstrappingResultPromises.app,
        ]);
        const [browserSetResults, testResults, appResults] = bootstrappingResults;
        if (isPromiseError(browserSetResults) || isPromiseError(testResults) || isPromiseError(appResults))
            throw await this._getBootstrappingError(...bootstrappingResults);
        return {
            browserSet: browserSetResults.result,
            tests: testResults.result,
            testedApp: appResults.result,
        };
    }
    // API
    async createRunnableConfiguration() {
        const id = (0, testcafe_hammerhead_1.generateUniqueId)();
        const commonClientScripts = await (0, load_1.default)(this.clientScripts);
        if (await this._canUseParallelBootstrapping(this.browsers))
            return Object.assign(Object.assign({}, await this._bootstrapParallel(this.browsers, id)), { commonClientScripts, id });
        return Object.assign(Object.assign({}, await this._bootstrapSequence(this.browsers, id)), { commonClientScripts, id });
    }
}
exports.default = Bootstrapper;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdHN0cmFwcGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3J1bm5lci9ib290c3RyYXBwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxtQ0FNZ0I7QUFFaEIsa0RBQTBCO0FBQzFCLGtFQUF1QztBQUN2QywyREFBbUM7QUFDbkMsdUVBQXVFO0FBQ3ZFLGdFQUF1QztBQUN2QywrQ0FBaUQ7QUFDakQsMkNBQWlEO0FBQ2pELDhEQUFxQztBQUNyQywrRUFBcUQ7QUFDckQseUVBQThEO0FBQzlELDRDQUE4RDtBQVM5RCwrRUFBc0Q7QUFDdEQsdUZBQWdFO0FBQ2hFLHlGQUErRDtBQUMvRCx5RUFBZ0Q7QUFHaEQsbUZBQXlEO0FBQ3pELHVFQUFtRTtBQUNuRSw2REFBdUQ7QUFDdkQsbUZBQXFFO0FBQ3JFLDJFQUFrRDtBQUVsRCxpRkFBeUQ7QUFFekQsTUFBTSxXQUFXLEdBQUcsdUJBQXVCLENBQUM7QUEyQjVDLFNBQVMsY0FBYyxDQUE4QixLQUEwQjtJQUMzRSxPQUFRLEtBQXlCLENBQUMsS0FBSyxLQUFLLEtBQUssQ0FBQyxDQUFDO0FBQ3ZELENBQUM7QUFhRCxNQUFxQixZQUFZO0lBeUI3QixZQUFvQixFQUFFLHdCQUF3QixFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFvQjtRQUMxRyxJQUFJLENBQUMsd0JBQXdCLEdBQUcsd0JBQXdCLENBQUM7UUFDekQsSUFBSSxDQUFDLFdBQVcsR0FBZ0IsQ0FBQyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxPQUFPLEdBQW9CLEVBQUUsQ0FBQztRQUNuQyxJQUFJLENBQUMsUUFBUSxHQUFtQixFQUFFLENBQUM7UUFDbkMsSUFBSSxDQUFDLFNBQVMsR0FBa0IsRUFBRSxDQUFDO1FBQ25DLElBQUksQ0FBQyxNQUFNLEdBQXFCLEtBQUssQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxVQUFVLEdBQWlCLEtBQUssQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxZ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c291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgICBjaHVuayxcbiAgICB0aW1lcyxcbiAgICB1bmlvbixcbiAgICBjYXN0QXJyYXksXG4gICAgZmxhdHRlbkRlZXAgYXMgZmxhdHRlbixcbn0gZnJvbSAnbG9kYXNoJztcblxuaW1wb3J0IGRlYnVnIGZyb20gJ2RlYnVnJztcbmltcG9ydCBwcmV0dHlUaW1lIGZyb20gJ3ByZXR0eS1ocnRpbWUnO1xuaW1wb3J0IENvbXBpbGVyIGZyb20gJy4uL2NvbXBpbGVyJztcbmltcG9ydCBCcm93c2VyQ29ubmVjdGlvbiwgeyBCcm93c2VySW5mbyB9IGZyb20gJy4uL2Jyb3dzZXIvY29ubmVjdGlvbic7XG5pbXBvcnQgQnJvd3NlclNldCBmcm9tICcuL2Jyb3dzZXItc2V0JztcbmltcG9ydCB7IEdlbmVyYWxFcnJvciB9IGZyb20gJy4uL2Vycm9ycy9ydW50aW1lJztcbmltcG9ydCB7IFJVTlRJTUVfRVJST1JTIH0gZnJvbSAnLi4vZXJyb3JzL3R5cGVzJztcbmltcG9ydCBUZXN0ZWRBcHAgZnJvbSAnLi90ZXN0ZWQtYXBwJztcbmltcG9ydCBwYXJzZUZpbGVMaXN0IGZyb20gJy4uL3V0aWxzL3BhcnNlLWZpbGUtbGlzdCc7XG5pbXBvcnQgbG9hZENsaWVudFNjcmlwdHMgZnJvbSAnLi4vY3VzdG9tLWNsaWVudC1zY3JpcHRzL2xvYWQnO1xuaW1wb3J0IHsgZ2V0Q29uY2F0ZW5hdGVkVmFsdWVzU3RyaW5nIH0gZnJvbSAnLi4vdXRpbHMvc3RyaW5nJztcbmltcG9ydCB7IFJlcG9ydGVyU291cmNlIH0gZnJvbSAnLi4vcmVwb3J0ZXIvaW50ZXJmYWNlcyc7XG5pbXBvcnQgQ2xpZW50U2NyaXB0IGZyb20gJy4uL2N1c3RvbS1jbGllbnQtc2NyaXB0cy9jbGllbnQtc2NyaXB0JztcbmltcG9ydCBDbGllbnRTY3JpcHRJbml0IGZyb20gJy4uL2N1c3RvbS1jbGllbnQtc2NyaXB0cy9jbGllbnQtc2NyaXB0LWluaXQnO1xuaW1wb3J0IEJyb3dzZXJDb25uZWN0aW9uR2F0ZXdheSBmcm9tICcuLi9icm93c2VyL2Nvbm5lY3Rpb24vZ2F0ZXdheSc7XG5pbXBvcnQgeyBDb21waWxlckFyZ3VtZW50cyB9IGZyb20gJy4uL2NvbXBpbGVyL2ludGVyZmFjZXMnO1xuaW1wb3J0IENvbXBpbGVyU2VydmljZSBmcm9tICcuLi9zZXJ2aWNlcy9jb21waWxlci9ob3N0JztcbmltcG9ydCBUZXN0IGZyb20gJy4uL2FwaS9zdHJ1Y3R1cmUvdGVzdCc7XG5pbXBvcnQgeyBCb290c3RyYXBwZXJJbml0LCBCcm93c2VyU2V0T3B0aW9ucyB9IGZyb20gJy4vaW50ZXJmYWNlcyc7XG5pbXBvcnQgV2FybmluZ0xvZyBmcm9tICcuLi9ub3RpZmljYXRpb25zL3dhcm5pbmctbG9nJztcbmltcG9ydCBXQVJOSU5HX01FU1NBR0VTIGZyb20gJy4uL25vdGlmaWNhdGlvbnMvd2FybmluZy1tZXNzYWdlJztcbmltcG9ydCBndWFyZFRpbWVFeGVjdXRpb24gZnJvbSAnLi4vdXRpbHMvZ3VhcmQtdGltZS1leGVjdXRpb24nO1xuaW1wb3J0IGFzeW5jRmlsdGVyIGZyb20gJy4uL3V0aWxzL2FzeW5jLWZpbHRlcic7XG5pbXBvcnQgRml4dHVyZSBmcm9tICcuLi9hcGkvc3RydWN0dXJlL2ZpeHR1cmUnO1xuaW1wb3J0IE1lc3NhZ2VCdXMgZnJvbSAnLi4vdXRpbHMvbWVzc2FnZS1idXMnO1xuaW1wb3J0IHdyYXBUZXN0RnVuY3Rpb24gZnJvbSAnLi4vYXBpL3dyYXAtdGVzdC1mdW5jdGlvbic7XG5pbXBvcnQgeyBhc3NlcnRUeXBlLCBpcyB9IGZyb20gJy4uL2Vycm9ycy9ydW50aW1lL3R5cGUtYXNzZXJ0aW9ucyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVVuaXF1ZUlkIH0gZnJvbSAndGVzdGNhZmUtaGFtbWVyaGVhZCc7XG5pbXBvcnQgYXNzZXJ0UmVxdWVzdEhvb2tUeXBlIGZyb20gJy4uL2FwaS9yZXF1ZXN0LWhvb2tzL2Fzc2VydC10eXBlJztcbmltcG9ydCB1c2VyVmFyaWFibGVzIGZyb20gJy4uL2FwaS91c2VyLXZhcmlhYmxlcyc7XG5pbXBvcnQgQ29uZmlndXJhdGlvbiBmcm9tICcuLi9jb25maWd1cmF0aW9uL2NvbmZpZ3VyYXRpb24tYmFzZSc7XG5pbXBvcnQgT1BUSU9OX05BTUVTIGZyb20gJy4uL2NvbmZpZ3VyYXRpb24vb3B0aW9uLW5hbWVzJztcblxuY29uc3QgREVCVUdfU0NPUEUgPSAndGVzdGNhZmU6Ym9vdHN0cmFwcGVyJztcblxudHlwZSBUZXN0U291cmNlID0gdW5rbm93bjtcblxudHlwZSBCcm93c2VySW5mb1NvdXJjZSA9IEJyb3dzZXJJbmZvIHwgQnJvd3NlckNvbm5lY3Rpb247XG5cbmludGVyZmFjZSBQcm9taXNlU3VjY2VzczxUPiB7XG4gICAgcmVzdWx0OiBUO1xufVxuXG5pbnRlcmZhY2UgUHJvbWlzZUVycm9yPEUgZXh0ZW5kcyBFcnJvciA9IEVycm9yPiB7XG4gICAgZXJyb3I6IEU7XG59XG5cbmludGVyZmFjZSBCYXNpY1J1bnRpbWVSZXNvdXJjZXMge1xuICAgIGJyb3dzZXJTZXQ6IEJyb3dzZXJTZXQ7XG4gICAgdGVzdHM6IFRlc3RbXTtcbiAgICB0ZXN0ZWRBcHA/OiBUZXN0ZWRBcHA7XG59XG5cbmludGVyZmFjZSBSdW5uYWJsZUNvbmZpZ3VyYXRpb24gZXh0ZW5kcyBCYXNpY1J1bnRpbWVSZXNvdXJjZXMge1xuICAgIGNvbW1vbkNsaWVudFNjcmlwdHM6IENsaWVudFNjcmlwdFtdO1xuICAgIGlkOiBzdHJpbmc7XG59XG5cbnR5cGUgUHJvbWlzZVJlc3VsdDxULCBFIGV4dGVuZHMgRXJyb3IgPSBFcnJvcj4gPSBQcm9taXNlU3VjY2VzczxUPiB8IFByb21pc2VFcnJvcjxFPjtcblxuZnVuY3Rpb24gaXNQcm9taXNlRXJyb3I8VCwgRSBleHRlbmRzIEVycm9yID0gRXJyb3I+ICh2YWx1ZTogUHJvbWlzZVJlc3VsdDxULCBFPik6IHZhbHVlIGlzIFByb21pc2VFcnJvcjxFPiB7XG4gICAgcmV0dXJuICh2YWx1ZSBhcyBQcm9taXNlRXJyb3I8RT4pLmVycm9yICE9PSB2b2lkIDA7XG59XG5cbmludGVyZmFjZSBTZXBhcmF0ZWRCcm93c2VySW5mbyB7XG4gICAgcmVtb3RlczogQnJvd3NlckNvbm5lY3Rpb25bXTtcbiAgICBhdXRvbWF0ZWQ6IEJyb3dzZXJJbmZvW107XG59XG5cbnR5cGUgUHJvbWlzZUNvbGxlY3Rpb248VD4gPSB7XG4gICAgW0sgaW4ga2V5b2YgVF06IFByb21pc2U8VFtLXT5cbn1cblxudHlwZSBSZXN1bHRDb2xsZWN0aW9uPFQ+ID0geyBbUCBpbiBrZXlvZiBUXTogUHJvbWlzZVJlc3VsdDxUW1BdPiB9O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBCb290c3RyYXBwZXIge1xuICAgIHByaXZhdGUgcmVhZG9ubHkgYnJvd3NlckNvbm5lY3Rpb25HYXRld2F5OiBCcm93c2VyQ29ubmVjdGlvbkdhdGV3YXk7XG4gICAgcHVibGljIGNvbmN1cnJlbmN5OiBudW1iZXI7XG4gICAgcHVibGljIHNvdXJjZXM6IFRlc3RTb3VyY2VbXTtcbiAgICBwdWJsaWMgYnJvd3NlcnM6IEJyb3dzZXJJbmZvU291cmNlW107XG4gICAgcHVibGljIHJlcG9ydGVyczogUmVwb3J0ZXJTb3VyY2VbXTtcbiAgICBwdWJsaWMgZmlsdGVyPzogRmlsdGVyRnVuY3Rpb247XG4gICAgcHVibGljIGFwcENvbW1hbmQ/OiBzdHJpbmc7XG4gICAgcHVibGljIGFwcEluaXREZWxheT86IG51bWJlcjtcbiAgICBwdWJsaWMgdHNDb25maWdQYXRoPzogc3RyaW5nO1xuICAgIHB1YmxpYyBjbGllbnRTY3JpcHRzOiBDbGllbnRTY3JpcHRJbml0W107XG4gICAgcHVibGljIGRpc2FibGVNdWx0aXBsZVdpbmRvd3M6IGJvb2xlYW47XG4gICAgcHVibGljIHByb3h5bGVzczogYm9vbGVhbjtcbiAgICBwdWJsaWMgY29tcGlsZXJPcHRpb25zPzogQ29tcGlsZXJPcHRpb25zO1xuICAgIHB1YmxpYyBicm93c2VySW5pdFRpbWVvdXQ/OiBudW1iZXI7XG4gICAgcHVibGljIGhvb2tzPzogR2xvYmFsSG9va3M7XG4gICAgcHVibGljIGNvbmZpZ3VyYXRpb246IENvbmZpZ3VyYXRpb247XG5cbiAgICBwcml2YXRlIHJlYWRvbmx5IGNvbXBpbGVyU2VydmljZT86IENvbXBpbGVyU2VydmljZTtcbiAgICBwcml2YXRlIHJlYWRvbmx5IGRlYnVnTG9nZ2VyOiBkZWJ1Zy5EZWJ1Z2dlcjtcbiAgICBwcml2YXRlIHJlYWRvbmx5IHdhcm5pbmdMb2c6IFdhcm5pbmdMb2c7XG4gICAgcHJpdmF0ZSByZWFkb25seSBtZXNzYWdlQnVzOiBNZXNzYWdlQnVzO1xuXG4gICAgcHJpdmF0ZSByZWFkb25seSBURVNUU19DT01QSUxBVElPTl9VUFBFUkJPVU5EOiBudW1iZXI7XG5cbiAgICBwdWJsaWMgY29uc3RydWN0b3IgKHsgYnJvd3NlckNvbm5lY3Rpb25HYXRld2F5LCBjb21waWxlclNlcnZpY2UsIG1lc3NhZ2VCdXMsIGNvbmZpZ3VyYXRpb24gfTogQm9vdHN0cmFwcGVySW5pdCkge1xuICAgICAgICB0aGlzLmJyb3dzZXJDb25uZWN0aW9uR2F0ZXdheSA9IGJyb3dzZXJDb25uZWN0aW9uR2F0ZXdheTtcbiAgICAgICAgdGhpcy5jb25jdXJyZW5jeSAgICAgICAgICAgICAgPSAxO1xuICAgICAgICB0aGlzLnNvdXJjZXMgICAgICAgICAgICAgICAgICA9IFtdO1xuICAgICAgICB0aGlzLmJyb3dzZXJzICAgICAgICAgICAgICAgICA9IFtdO1xuICAgICAgICB0aGlzLnJlcG9ydGVycyAgICAgICAgICAgICAgICA9IFtdO1xuICAgICAgICB0aGlzLmZpbHRlciAgICAgICAgICAgICAgICAgICA9IHZvaWQgMDtcbiAgICAgICAgdGhpcy5hcHBDb21tYW5kICAgICAgICAgICAgICAgPSB2b2lkIDA7XG4gICAgICAgIHRoaXMuYXBwSW5pdERlbGF5ICAgICAgICAgICAgID0gdm9pZCAwO1xuICAgICAgICB0aGlzLnRzQ29uZmlnUGF0aCAgICAgICAgICAgICA9IHZvaWQgMDtcbiAgICAgICAgdGhpcy5jbGllbnRTY3JpcHRzICAgICAgICAgICAgPSBbXTtcbiAgICAgICAgdGhpcy5kaXNhYmxlTXVsdGlwbGVXaW5kb3dzICAgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5wcm94eWxlc3MgICAgICAgICAgICAgICAgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5jb21waWxlck9wdGlvbnMgICAgICAgICAgPSB2b2lkIDA7XG4gICAgICAgIHRoaXMuZGVidWdMb2dnZXIgICAgICAgICAgICAgID0gZGVidWcoREVCVUdfU0NPUEUpO1xuICAgICAgICB0aGlzLndhcm5pbmdMb2cgICAgICAgICAgICAgICA9IG5ldyBXYXJuaW5nTG9nKG51bGwsIFdhcm5pbmdMb2cuY3JlYXRlQWRkV2FybmluZ0NhbGxiYWNrKG1lc3NhZ2VCdXMpKTtcbiAgICAgICAgdGhpcy5jb21waWxlclNlcnZpY2UgICAgICAgICAgPSBjb21waWxlclNlcnZpY2U7XG4gICAgICAgIHRoaXMubWVzc2FnZUJ1cyAgICAgICAgICAgICAgID0gbWVzc2FnZUJ1cztcbiAgICAgICAgdGhpcy5jb25maWd1cmF0aW9uICAgICAgICAgICAgPSBjb25maWd1cmF0aW9uO1xuXG4gICAgICAgIHRoaXMuVEVTVFNfQ09NUElMQVRJT05fVVBQRVJCT1VORCA9IDYwO1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdGljIF9nZXRCcm93c2VyTmFtZSAoYnJvd3NlcjogQnJvd3NlckluZm9Tb3VyY2UpOiBzdHJpbmcge1xuICAgICAgICBpZiAoYnJvd3NlciBpbnN0YW5jZW9mIEJyb3dzZXJDb25uZWN0aW9uKVxuICAgICAgICAgICAgcmV0dXJuIGJyb3dzZXIuYnJvd3NlckluZm8uYnJvd3Nlck5hbWU7XG5cbiAgICAgICAgcmV0dXJuIGJyb3dzZXIuYnJvd3Nlck5hbWU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdGF0aWMgX3NwbGl0QnJvd3NlckluZm8gKGJyb3dzZXJJbmZvOiBCcm93c2VySW5mb1NvdXJjZVtdKTogU2VwYXJhdGVkQnJvd3NlckluZm8ge1xuICAgICAgICBjb25zdCByZW1vdGVzOiBCcm93c2VyQ29ubmVjdGlvbltdICA9IFtdO1xuICAgICAgICBjb25zdCBhdXRvbWF0ZWQ6IEJyb3dzZXJJbmZvW10gICAgICA9IFtdO1xuXG4gICAgICAgIGJyb3dzZXJJbmZvLmZvckVhY2goYnJvd3NlciA9PiB7XG4gICAgICAgICAgICBpZiAoYnJvd3NlciBpbnN0YW5jZW9mIEJyb3dzZXJDb25uZWN0aW9uKVxuICAgICAgICAgICAgICAgIHJlbW90ZXMucHVzaChicm93c2VyKTtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBhdXRvbWF0ZWQucHVzaChicm93c2VyKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHsgcmVtb3RlcywgYXV0b21hdGVkIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfY3JlYXRlQXV0b21hdGVkQ29ubmVjdGlvbnMgKGJyb3dzZXJJbmZvOiBCcm93c2VySW5mb1tdKTogQnJvd3NlckNvbm5lY3Rpb25bXVtdIHtcbiAgICAgICAgaWYgKCFicm93c2VySW5mbylcbiAgICAgICAgICAgIHJldHVybiBbXTtcblxuICAgICAgICByZXR1cm4gYnJvd3NlckluZm9cbiAgICAgICAgICAgIC5tYXAoYnJvd3NlciA9PiB0aW1lcyh0aGlzLmNvbmN1cnJlbmN5LCAoKSA9PiBuZXcgQnJvd3NlckNvbm5lY3Rpb24oXG4gICAgICAgICAgICAgICAgdGhpcy5icm93c2VyQ29ubmVjdGlvbkdhdGV3YXksIHsgLi4uYnJvd3NlciB9LCBmYWxzZSwgdGhpcy5kaXNhYmxlTXVsdGlwbGVXaW5kb3dzLCB0aGlzLnByb3h5bGVzcywgdGhpcy5tZXNzYWdlQnVzKSkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgX2dldEJyb3dzZXJTZXRPcHRpb25zICgpOiBCcm93c2VyU2V0T3B0aW9ucyB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb25jdXJyZW5jeTogICAgICAgIHRoaXMuY29uY3VycmVuY3ksXG4gICAgICAgICAgICBicm93c2VySW5pdFRpbWVvdXQ6IHRoaXMuYnJvd3NlckluaXRUaW1lb3V0LFxuICAgICAgICAgICAgd2FybmluZ0xvZzogICAgICAgICB0aGlzLndhcm5pbmdMb2csXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfZ2V0QnJvd3NlckNvbm5lY3Rpb25zIChicm93c2VySW5mbzogQnJvd3NlckluZm9Tb3VyY2VbXSk6IFByb21pc2U8QnJvd3NlclNldD4ge1xuICAgICAgICBjb25zdCB7IGF1dG9tYXRlZCwgcmVtb3RlcyB9ID0gQm9vdHN0cmFwcGVyLl9zcGxpdEJyb3dzZXJJbmZvKGJyb3dzZXJJbmZvKTtcblxuICAgICAgICBpZiAocmVtb3RlcyAmJiByZW1vdGVzLmxlbmd0aCAlIHRoaXMuY29uY3VycmVuY3kpXG4gICAgICAgICAgICB0aHJvdyBuZXcgR2VuZXJhbEVycm9yKFJVTlRJTUVfRVJST1JTLmNhbm5vdERpdmlkZVJlbW90ZXNDb3VudEJ5Q29uY3VycmVuY3kpO1xuXG4gICAgICAgIGxldCBicm93c2VyQ29ubmVjdGlvbnMgPSB0aGlzLl9jcmVhdGVBdXRvbWF0ZWRDb25uZWN0aW9ucyhhdXRvbWF0ZWQpO1xuXG4gICAgICAgIHJlbW90ZXMuZm9yRWFjaChyZW1vdGVDb25uZWN0aW9uID0+IHtcbiAgICAgICAgICAgIHJlbW90ZUNvbm5lY3Rpb24ubWVzc2FnZUJ1cyA9IHRoaXMubWVzc2FnZUJ1cztcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYnJvd3NlckNvbm5lY3Rpb25zID0gYnJvd3NlckNvbm5lY3Rpb25zLmNvbmNhdChjaHVuayhyZW1vdGVzLCB0aGlzLmNvbmN1cnJlbmN5KSk7XG5cbiAgICAgICAgcmV0dXJuIEJyb3dzZXJTZXQuZnJvbShicm93c2VyQ29ubmVjdGlvbnMsIHRoaXMuX2dldEJyb3dzZXJTZXRPcHRpb25zKCkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgX2ZpbHRlclRlc3RzICh0ZXN0czogVGVzdFtdLCBwcmVkaWNhdGU6IEZpbHRlckZ1bmN0aW9uKTogUHJvbWlzZTxUZXN0W10+IHtcbiAgICAgICAgcmV0dXJuIGFzeW5jRmlsdGVyKHRlc3RzLCB0ZXN0ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRlc3RGaXh0dXJlID0gdGVzdC5maXh0dXJlIGFzIEZpeHR1cmU7XG5cbiAgICAgICAgICAgIHJldHVybiBwcmVkaWNhdGUoXG4gICAgICAgICAgICAgICAgdGVzdC5uYW1lIGFzIHN0cmluZyxcbiAgICAgICAgICAgICAgICB0ZXN0Rml4dHVyZS5uYW1lIGFzIHN0cmluZyxcbiAgICAgICAgICAgICAgICB0ZXN0Rml4dHVyZS5wYXRoLFxuICAgICAgICAgICAgICAgIHRlc3QubWV0YSxcbiAgICAgICAgICAgICAgICB0ZXN0Rml4dHVyZS5tZXRhKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfY29tcGlsZVRlc3RzICh7IHNvdXJjZUxpc3QsIGNvbXBpbGVyT3B0aW9ucywgcnVubmFibGVDb25maWd1cmF0aW9uSWQgfTogQ29tcGlsZXJBcmd1bWVudHMpOiBQcm9taXNlPFRlc3RbXT4ge1xuICAgICAgICBjb25zdCBiYXNlVXJsICA9IHRoaXMuY29uZmlndXJhdGlvbi5nZXRPcHRpb24oT1BUSU9OX05BTUVTLmJhc2VVcmwpIGFzIHN0cmluZztcblxuICAgICAgICBpZiAodGhpcy5jb21waWxlclNlcnZpY2UpIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuY29tcGlsZXJTZXJ2aWNlLmluaXQoKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuY29tcGlsZXJTZXJ2aWNlLnNldFVzZXJWYXJpYWJsZXModXNlclZhcmlhYmxlcy52YWx1ZSk7XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbXBpbGVyU2VydmljZS5nZXRUZXN0cyh7IHNvdXJjZUxpc3QsIGNvbXBpbGVyT3B0aW9ucywgcnVubmFibGVDb25maWd1cmF0aW9uSWQgfSwgYmFzZVVybCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb21waWxlciA9IG5ldyBDb21waWxlcihzb3VyY2VMaXN0LCBjb21waWxlck9wdGlvbnMsIHsgYmFzZVVybCwgaXNDb21waWxlclNlcnZpY2VNb2RlOiBmYWxzZSB9KTtcblxuICAgICAgICByZXR1cm4gY29tcGlsZXIuZ2V0VGVzdHMoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIF9hc3NlcnRHbG9iYWxIb29rcyAoKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5ob29rcylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5ob29rcy5maXh0dXJlPy5iZWZvcmUpXG4gICAgICAgICAgICBhc3NlcnRUeXBlKGlzLmZ1bmN0aW9uLCAnZ2xvYmFsQmVmb3JlJywgJ1RoZSBmaXh0dXJlLmdsb2JhbEJlZm9yZSBob29rJywgdGhpcy5ob29rcy5maXh0dXJlLmJlZm9yZSk7XG5cbiAgICAgICAgaWYgKHRoaXMuaG9va3MuZml4dHVyZT8uYWZ0ZXIpXG4gICAgICAgICAgICBhc3NlcnRUeXBlKGlzLmZ1bmN0aW9uLCAnZ2xvYmFsQWZ0ZXInLCAnVGhlIGZpeHR1cmUuZ2xvYmFsQWZ0ZXIgaG9vaycsIHRoaXMuaG9va3MuZml4dHVyZS5hZnRlcik7XG5cbiAgICAgICAgaWYgKHRoaXMuaG9va3MudGVzdD8uYmVmb3JlKVxuICAgICAgICAgICAgYXNzZXJ0VHlwZShpcy5mdW5jdGlvbiwgJ2dsb2JhbEJlZm9yZScsICdUaGUgdGVzdC5nbG9iYWxCZWZvcmUgaG9vaycsIHRoaXMuaG9va3MudGVzdC5iZWZvcmUpO1xuXG4gICAgICAgIGlmICh0aGlzLmhvb2tzLnRlc3Q/LmFmdGVyKVxuICAgICAgICAgICAgYXNzZXJ0VHlwZShpcy5mdW5jdGlvbiwgJ2dsb2JhbEFmdGVyJywgJ1RoZSB0ZXN0Lmdsb2JhbEFmdGVyIGhvb2snLCB0aGlzLmhvb2tzLnRlc3QuYWZ0ZXIpO1xuXG4gICAgICAgIGlmICh0aGlzLmhvb2tzLnJlcXVlc3QpXG4gICAgICAgICAgICBhc3NlcnRSZXF1ZXN0SG9va1R5cGUoZmxhdHRlbihjYXN0QXJyYXkodGhpcy5ob29rcy5yZXF1ZXN0KSkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgX3NldEdsb2JhbEhvb2tzVG9UZXN0cyAodGVzdHM6IFRlc3RbXSk6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMuaG9va3MpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fYXNzZXJ0R2xvYmFsSG9va3MoKTtcblxuICAgICAgICBjb25zdCBmaXh0dXJlQmVmb3JlID0gdGhpcy5ob29rcy5maXh0dXJlPy5iZWZvcmUgfHwgbnVsbDtcbiAgICAgICAgY29uc3QgZml4dHVyZUFmdGVyICA9IHRoaXMuaG9va3MuZml4dHVyZT8uYWZ0ZXIgfHwgbnVsbDtcbiAgICAgICAgY29uc3QgdGVzdEJlZm9yZSAgICA9IHRoaXMuaG9va3MudGVzdD8uYmVmb3JlID8gd3JhcFRlc3RGdW5jdGlvbih0aGlzLmhvb2tzLnRlc3QuYmVmb3JlKSA6IG51bGw7XG4gICAgICAgIGNvbnN0IHRlc3RBZnRlciAgICAgPSB0aGlzLmhvb2tzLnRlc3Q/LmFmdGVyID8gd3JhcFRlc3RGdW5jdGlvbih0aGlzLmhvb2tzLnRlc3QuYWZ0ZXIpIDogbnVsbDtcbiAgICAgICAgY29uc3QgcmVxdWVzdCAgICAgICA9IHRoaXMuaG9va3MucmVxdWVzdCB8fCBbXTtcblxuICAgICAgICB0ZXN0cy5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgICAgICAgaWYgKGl0ZW0uZml4dHVyZSkge1xuICAgICAgICAgICAgICAgIGl0ZW0uZml4dHVyZS5nbG9iYWxCZWZvcmVGbiA9IGl0ZW0uZml4dHVyZS5nbG9iYWxCZWZvcmVGbiB8fCBmaXh0dXJlQmVmb3JlO1xuICAgICAgICAgICAgICAgIGl0ZW0uZml4dHVyZS5nbG9iYWxBZnRlckZuICA9IGl0ZW0uZml4dHVyZS5nbG9iYWxBZnRlckZuIHx8IGZpeHR1cmVBZnRlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaXRlbS5nbG9iYWxCZWZvcmVGbiA9IHRlc3RCZWZvcmU7XG4gICAgICAgICAgICBpdGVtLmdsb2JhbEFmdGVyRm4gID0gdGVzdEFmdGVyO1xuICAgICAgICAgICAgaXRlbS5yZXF1ZXN0SG9va3MgICA9IHVuaW9uKGZsYXR0ZW4oY2FzdEFycmF5KHJlcXVlc3QpKSwgaXRlbS5yZXF1ZXN0SG9va3MpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIF9nZXRUZXN0cyAoaWQ6IHN0cmluZyk6IFByb21pc2U8VGVzdFtdPiB7XG4gICAgICAgIGNvbnN0IGN3ZCAgICAgICAgPSBwcm9jZXNzLmN3ZCgpO1xuICAgICAgICBjb25zdCBzb3VyY2VMaXN0ID0gYXdhaXQgcGFyc2VGaWxlTGlzdCh0aGlzLnNvdXJjZXMsIGN3ZCk7XG5cbiAgICAgICAgaWYgKCFzb3VyY2VMaXN0Lmxlbmd0aClcbiAgICAgICAgICAgIHRocm93IG5ldyBHZW5lcmFsRXJyb3IoUlVOVElNRV9FUlJPUlMudGVzdEZpbGVzTm90Rm91bmQsIGN3ZCwgZ2V0Q29uY2F0ZW5hdGVkVmFsdWVzU3RyaW5nKHRoaXMuc291cmNlcywgJ1xcbicsICcnKSk7XG5cbiAgICAgICAgbGV0IHRlc3RzID0gYXdhaXQgZ3VhcmRUaW1lRXhlY3V0aW9uKFxuICAgICAgICAgICAgYXN5bmMgKCkgPT4gYXdhaXQgdGhpcy5fY29tcGlsZVRlc3RzKHsgc291cmNlTGlzdCwgY29tcGlsZXJPcHRpb25zOiB0aGlzLmNvbXBpbGVyT3B0aW9ucywgcnVubmFibGVDb25maWd1cmF0aW9uSWQ6IGlkIH0pLFxuICAgICAgICAgICAgZWxhcHNlZFRpbWUgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVidWdMb2dnZXIoYHRlc3RzIGNvbXBpbGF0aW9uIHRvb2sgJHtwcmV0dHlUaW1lKGVsYXBzZWRUaW1lKX1gKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IFsgZWxhcHNlZFNlY29uZHMgXSA9IGVsYXBzZWRUaW1lO1xuXG4gICAgICAgICAgICAgICAgaWYgKGVsYXBzZWRTZWNvbmRzID4gdGhpcy5URVNUU19DT01QSUxBVElPTl9VUFBFUkJPVU5EKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLndhcm5pbmdMb2cuYWRkV2FybmluZyhXQVJOSU5HX01FU1NBR0VTLnRlc3RzQ29tcGlsYXRpb25UYWtlc1Rvb0xvbmcsIHByZXR0eVRpbWUoZWxhcHNlZFRpbWUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCB0ZXN0c1dpdGhPbmx5RmxhZyA9IHRlc3RzLmZpbHRlcih0ZXN0ID0+IHRlc3Qub25seSk7XG5cbiAgICAgICAgaWYgKHRlc3RzV2l0aE9ubHlGbGFnLmxlbmd0aClcbiAgICAgICAgICAgIHRlc3RzID0gdGVzdHNXaXRoT25seUZsYWc7XG5cbiAgICAgICAgaWYgKCF0ZXN0cy5sZW5ndGgpXG4gICAgICAgICAgICB0aHJvdyBuZXcgR2VuZXJhbEVycm9yKFJVTlRJTUVfRVJST1JTLm5vVGVzdHNUb1J1bik7XG5cbiAgICAgICAgaWYgKHRoaXMuZmlsdGVyKVxuICAgICAgICAgICAgdGVzdHMgPSBhd2FpdCB0aGlzLl9maWx0ZXJUZXN0cyh0ZXN0cywgdGhpcy5maWx0ZXIpO1xuXG4gICAgICAgIGlmICghdGVzdHMubGVuZ3RoKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEdlbmVyYWxFcnJvcihSVU5USU1FX0VSUk9SUy5ub1Rlc3RzVG9SdW5EdWVGaWx0ZXJpbmcpO1xuXG4gICAgICAgIHRoaXMuX3NldEdsb2JhbEhvb2tzVG9UZXN0cyh0ZXN0cyk7XG5cbiAgICAgICAgcmV0dXJuIHRlc3RzO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgX3N0YXJ0VGVzdGVkQXBwICgpOiBQcm9taXNlPFRlc3RlZEFwcHx1bmRlZmluZWQ+IHtcbiAgICAgICAgaWYgKCF0aGlzLmFwcENvbW1hbmQpXG4gICAgICAgICAgICByZXR1cm4gdm9pZCAwO1xuXG4gICAgICAgIGNvbnN0IHRlc3RlZEFwcCA9IG5ldyBUZXN0ZWRBcHAoKTtcblxuICAgICAgICBhd2FpdCB0ZXN0ZWRBcHAuc3RhcnQodGhpcy5hcHBDb21tYW5kLCB0aGlzLmFwcEluaXREZWxheSBhcyBudW1iZXIpO1xuXG4gICAgICAgIHJldHVybiB0ZXN0ZWRBcHA7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfY2FuVXNlUGFyYWxsZWxCb290c3RyYXBwaW5nIChicm93c2VySW5mbzogQnJvd3NlckluZm9Tb3VyY2VbXSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICBjb25zdCBpc0xvY2FsUHJvbWlzZXMgPSBicm93c2VySW5mby5tYXAoYnJvd3NlciA9PiBicm93c2VyLnByb3ZpZGVyLmlzTG9jYWxCcm93c2VyKHZvaWQgMCwgQm9vdHN0cmFwcGVyLl9nZXRCcm93c2VyTmFtZShicm93c2VyKSkpO1xuICAgICAgICBjb25zdCBpc0xvY2FsQnJvd3NlcnMgPSBhd2FpdCBQcm9taXNlLmFsbChpc0xvY2FsUHJvbWlzZXMpO1xuXG4gICAgICAgIHJldHVybiBpc0xvY2FsQnJvd3NlcnMuZXZlcnkocmVzdWx0ID0+IHJlc3VsdCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfYm9vdHN0cmFwU2VxdWVuY2UgKGJyb3dzZXJJbmZvOiBCcm93c2VySW5mb1NvdXJjZVtdLCBpZDogc3RyaW5nKTogUHJvbWlzZTxCYXNpY1J1bnRpbWVSZXNvdXJjZXM+IHtcbiAgICAgICAgY29uc3QgdGVzdHMgICAgICAgPSBhd2FpdCB0aGlzLl9nZXRUZXN0cyhpZCk7XG4gICAgICAgIGNvbnN0IHRlc3RlZEFwcCAgID0gYXdhaXQgdGhpcy5fc3RhcnRUZXN0ZWRBcHAoKTtcbiAgICAgICAgY29uc3QgYnJvd3NlclNldCAgPSBhd2FpdCB0aGlzLl9nZXRCcm93c2VyQ29ubmVjdGlvbnMoYnJvd3NlckluZm8pO1xuXG4gICAgICAgIHJldHVybiB7IHRlc3RzLCB0ZXN0ZWRBcHAsIGJyb3dzZXJTZXQgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIF93cmFwQm9vdHN0cmFwcGluZ1Byb21pc2U8VD4gKHByb21pc2U6IFByb21pc2U8VD4pOiBQcm9taXNlPFByb21pc2VSZXN1bHQ8VD4+IHtcbiAgICAgICAgcmV0dXJuIHByb21pc2VcbiAgICAgICAgICAgIC50aGVuKHJlc3VsdCA9PiAoeyBlcnJvcjogdm9pZCAwLCByZXN1bHQgfSkpXG4gICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4gKHsgcmVzdWx0OiB2b2lkIDAsIGVycm9yIH0pKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIF9nZXRCb290c3RyYXBwaW5nRXJyb3IgKGJyb3dzZXJTZXRTdGF0dXM6IFByb21pc2VSZXN1bHQ8QnJvd3NlclNldD4sIHRlc3RzU3RhdHVzOiBQcm9taXNlUmVzdWx0PFRlc3RbXT4sIHRlc3RlZEFwcFN0YXR1czogUHJvbWlzZVJlc3VsdDxUZXN0ZWRBcHB8dW5kZWZpbmVkPik6IFByb21pc2U8RXJyb3I+IHtcbiAgICAgICAgaWYgKCFpc1Byb21pc2VFcnJvcihicm93c2VyU2V0U3RhdHVzKSlcbiAgICAgICAgICAgIGF3YWl0IGJyb3dzZXJTZXRTdGF0dXMucmVzdWx0LmRpc3Bvc2UoKTtcblxuICAgICAgICBpZiAoIWlzUHJvbWlzZUVycm9yKGJyb3dzZXJTZXRTdGF0dXMpICYmICFpc1Byb21pc2VFcnJvcih0ZXN0ZWRBcHBTdGF0dXMpICYmIHRlc3RlZEFwcFN0YXR1cy5yZXN1bHQpXG4gICAgICAgICAgICBhd2FpdCB0ZXN0ZWRBcHBTdGF0dXMucmVzdWx0LmtpbGwoKTtcblxuICAgICAgICBpZiAoaXNQcm9taXNlRXJyb3IodGVzdHNTdGF0dXMpKVxuICAgICAgICAgICAgcmV0dXJuIHRlc3RzU3RhdHVzLmVycm9yO1xuXG4gICAgICAgIGlmIChpc1Byb21pc2VFcnJvcih0ZXN0ZWRBcHBTdGF0dXMpKVxuICAgICAgICAgICAgcmV0dXJuIHRlc3RlZEFwcFN0YXR1cy5lcnJvcjtcblxuICAgICAgICBpZiAoaXNQcm9taXNlRXJyb3IoYnJvd3NlclNldFN0YXR1cykpXG4gICAgICAgICAgICByZXR1cm4gYnJvd3NlclNldFN0YXR1cy5lcnJvcjtcblxuICAgICAgICByZXR1cm4gbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNhbGwnKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIF9nZXRCb290c3RyYXBwaW5nUHJvbWlzZXM8VD4gKGFyZzogUHJvbWlzZUNvbGxlY3Rpb248VD4pOiBQcm9taXNlQ29sbGVjdGlvbjxSZXN1bHRDb2xsZWN0aW9uPFQ+PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHt9IGFzIHVua25vd24gYXMgUHJvbWlzZUNvbGxlY3Rpb248UmVzdWx0Q29sbGVjdGlvbjxUPj47XG5cbiAgICAgICAgZm9yIChjb25zdCBrIGluIGFyZylcbiAgICAgICAgICAgIHJlc3VsdFtrXSA9IHRoaXMuX3dyYXBCb290c3RyYXBwaW5nUHJvbWlzZShhcmdba10pO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfYm9vdHN0cmFwUGFyYWxsZWwgKGJyb3dzZXJJbmZvOiBCcm93c2VySW5mb1NvdXJjZVtdLCBpZDogc3RyaW5nKTogUHJvbWlzZTxCYXNpY1J1bnRpbWVSZXNvdXJjZXM+IHtcbiAgICAgICAgY29uc3QgYm9vdHN0cmFwcGluZ1Byb21pc2VzID0ge1xuICAgICAgICAgICAgYnJvd3NlclNldDogdGhpcy5fZ2V0QnJvd3NlckNvbm5lY3Rpb25zKGJyb3dzZXJJbmZvKSxcbiAgICAgICAgICAgIHRlc3RzOiAgICAgIHRoaXMuX2dldFRlc3RzKGlkKSxcbiAgICAgICAgICAgIGFwcDogICAgICAgIHRoaXMuX3N0YXJ0VGVzdGVkQXBwKCksXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgYm9vdHN0cmFwcGluZ1Jlc3VsdFByb21pc2VzID0gdGhpcy5fZ2V0Qm9vdHN0cmFwcGluZ1Byb21pc2VzKGJvb3RzdHJhcHBpbmdQcm9taXNlcyk7XG5cbiAgICAgICAgY29uc3QgYm9vdHN0cmFwcGluZ1Jlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICBib290c3RyYXBwaW5nUmVzdWx0UHJvbWlzZXMuYnJvd3NlclNldCxcbiAgICAgICAgICAgIGJvb3RzdHJhcHBpbmdSZXN1bHRQcm9taXNlcy50ZXN0cyxcbiAgICAgICAgICAgIGJvb3RzdHJhcHBpbmdSZXN1bHRQcm9taXNlcy5hcHAsXG4gICAgICAgIF0pO1xuXG4gICAgICAgIGNvbnN0IFticm93c2VyU2V0UmVzdWx0cywgdGVzdFJlc3VsdHMsIGFwcFJlc3VsdHNdID0gYm9vdHN0cmFwcGluZ1Jlc3VsdHM7XG5cbiAgICAgICAgaWYgKGlzUHJvbWlzZUVycm9yKGJyb3dzZXJTZXRSZXN1bHRzKSB8fCBpc1Byb21pc2VFcnJvcih0ZXN0UmVzdWx0cykgfHwgaXNQcm9taXNlRXJyb3IoYXBwUmVzdWx0cykpXG4gICAgICAgICAgICB0aHJvdyBhd2FpdCB0aGlzLl9nZXRCb290c3RyYXBwaW5nRXJyb3IoLi4uYm9vdHN0cmFwcGluZ1Jlc3VsdHMpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBicm93c2VyU2V0OiBicm93c2VyU2V0UmVzdWx0cy5yZXN1bHQsXG4gICAgICAgICAgICB0ZXN0czogICAgICB0ZXN0UmVzdWx0cy5yZXN1bHQsXG4gICAgICAgICAgICB0ZXN0ZWRBcHA6ICBhcHBSZXN1bHRzLnJlc3VsdCxcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBBUElcbiAgICBwdWJsaWMgYXN5bmMgY3JlYXRlUnVubmFibGVDb25maWd1cmF0aW9uICgpOiBQcm9taXNlPFJ1bm5hYmxlQ29uZmlndXJhdGlvbj4ge1xuICAgICAgICBjb25zdCBpZCAgICAgICAgICAgICAgICAgID0gZ2VuZXJhdGVVbmlxdWVJZCgpO1xuICAgICAgICBjb25zdCBjb21tb25DbGllbnRTY3JpcHRzID0gYXdhaXQgbG9hZENsaWVudFNjcmlwdHModGhpcy5jbGllbnRTY3JpcHRzKTtcblxuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fY2FuVXNlUGFyYWxsZWxCb290c3RyYXBwaW5nKHRoaXMuYnJvd3NlcnMpKVxuICAgICAgICAgICAgcmV0dXJuIHsgLi4uYXdhaXQgdGhpcy5fYm9vdHN0cmFwUGFyYWxsZWwodGhpcy5icm93c2VycywgaWQpLCBjb21tb25DbGllbnRTY3JpcHRzLCBpZCB9O1xuXG4gICAgICAgIHJldHVybiB7IC4uLmF3YWl0IHRoaXMuX2Jvb3RzdHJhcFNlcXVlbmNlKHRoaXMuYnJvd3NlcnMsIGlkKSwgY29tbW9uQ2xpZW50U2NyaXB0cywgaWQgfTtcbiAgICB9XG59XG4iXX0=