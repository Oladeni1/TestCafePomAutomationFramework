"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unRegister = exports.register = exports.isLegacyTest = void 0;
const get_url_1 = __importDefault(require("./get-url"));
const get_code_1 = __importDefault(require("./get-code"));
const content_types_1 = __importDefault(require("../assets/content-types"));
function isLegacyTest(test) {
    return !!test.isLegacy;
}
exports.isLegacyTest = isLegacyTest;
function register(proxy, tests) {
    const routes = [];
    tests.forEach(test => {
        if (isLegacyTest(test))
            return;
        test.clientScripts.forEach((script) => {
            const route = (0, get_url_1.default)(script);
            proxy.GET(route, {
                content: (0, get_code_1.default)(script),
                contentType: content_types_1.default.javascript,
            });
            routes.push(route);
        });
    });
    return routes;
}
exports.register = register;
function unRegister(proxy, routes) {
    routes.forEach(route => {
        proxy.unRegisterRoute(route, 'GET');
    });
}
exports.unRegister = unRegister;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jdXN0b20tY2xpZW50LXNjcmlwdHMvcm91dGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSx3REFBaUQ7QUFDakQsMERBQW1EO0FBQ25ELDRFQUFvRDtBQWVwRCxTQUFnQixZQUFZLENBQUUsSUFBYztJQUN4QyxPQUFPLENBQUMsQ0FBRSxJQUFtQixDQUFDLFFBQVEsQ0FBQztBQUMzQyxDQUFDO0FBRkQsb0NBRUM7QUFFRCxTQUFnQixRQUFRLENBQUUsS0FBWSxFQUFFLEtBQWE7SUFDakQsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO0lBRTVCLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDakIsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDO1lBQ2xCLE9BQU87UUFFWCxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQXdCLEVBQUUsRUFBRTtZQUNwRCxNQUFNLEtBQUssR0FBRyxJQUFBLGlCQUF3QixFQUFDLE1BQXNCLENBQUMsQ0FBQztZQUUvRCxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRTtnQkFDYixPQUFPLEVBQU0sSUFBQSxrQkFBeUIsRUFBQyxNQUFzQixDQUFDO2dCQUM5RCxXQUFXLEVBQUUsdUJBQWEsQ0FBQyxVQUFVO2FBQ3hDLENBQUMsQ0FBQztZQUVILE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdkIsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sTUFBTSxDQUFDO0FBQ2xCLENBQUM7QUFwQkQsNEJBb0JDO0FBRUQsU0FBZ0IsVUFBVSxDQUFFLEtBQVksRUFBRSxNQUFnQjtJQUN0RCxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ25CLEtBQUssQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3hDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQztBQUpELGdDQUlDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGdldEN1c3RvbUNsaWVudFNjcmlwdFVybCBmcm9tICcuL2dldC11cmwnO1xuaW1wb3J0IGdldEN1c3RvbUNsaWVudFNjcmlwdENvZGUgZnJvbSAnLi9nZXQtY29kZSc7XG5pbXBvcnQgQ09OVEVOVF9UWVBFUyBmcm9tICcuLi9hc3NldHMvY29udGVudC10eXBlcyc7XG5pbXBvcnQgQ2xpZW50U2NyaXB0IGZyb20gJy4vY2xpZW50LXNjcmlwdCc7XG5pbXBvcnQgeyBQcm94eSB9IGZyb20gJ3Rlc3RjYWZlLWhhbW1lcmhlYWQnO1xuaW1wb3J0IENsaWVudFNjcmlwdEluaXQgZnJvbSAnLi9jbGllbnQtc2NyaXB0LWluaXQnO1xuXG5pbnRlcmZhY2UgVGVzdCB7XG4gICAgY2xpZW50U2NyaXB0czogQ2xpZW50U2NyaXB0SW5pdFtdO1xufVxuXG5pbnRlcmZhY2UgTGVnYWN5VGVzdCB7XG4gICAgaXNMZWdhY3k6IGJvb2xlYW47XG59XG5cbnR5cGUgVGVzdEl0ZW0gPSBUZXN0IHwgTGVnYWN5VGVzdDtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzTGVnYWN5VGVzdCAodGVzdDogVGVzdEl0ZW0pOiB0ZXN0IGlzIExlZ2FjeVRlc3Qge1xuICAgIHJldHVybiAhISh0ZXN0IGFzIExlZ2FjeVRlc3QpLmlzTGVnYWN5O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXIgKHByb3h5OiBQcm94eSwgdGVzdHM6IFRlc3RbXSk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCByb3V0ZXM6IHN0cmluZ1tdID0gW107XG5cbiAgICB0ZXN0cy5mb3JFYWNoKHRlc3QgPT4ge1xuICAgICAgICBpZiAoaXNMZWdhY3lUZXN0KHRlc3QpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRlc3QuY2xpZW50U2NyaXB0cy5mb3JFYWNoKChzY3JpcHQ6IENsaWVudFNjcmlwdEluaXQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJvdXRlID0gZ2V0Q3VzdG9tQ2xpZW50U2NyaXB0VXJsKHNjcmlwdCBhcyBDbGllbnRTY3JpcHQpO1xuXG4gICAgICAgICAgICBwcm94eS5HRVQocm91dGUsIHtcbiAgICAgICAgICAgICAgICBjb250ZW50OiAgICAgZ2V0Q3VzdG9tQ2xpZW50U2NyaXB0Q29kZShzY3JpcHQgYXMgQ2xpZW50U2NyaXB0KSxcbiAgICAgICAgICAgICAgICBjb250ZW50VHlwZTogQ09OVEVOVF9UWVBFUy5qYXZhc2NyaXB0LFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJvdXRlcy5wdXNoKHJvdXRlKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcm91dGVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdW5SZWdpc3RlciAocHJveHk6IFByb3h5LCByb3V0ZXM6IHN0cmluZ1tdKTogdm9pZCB7XG4gICAgcm91dGVzLmZvckVhY2gocm91dGUgPT4ge1xuICAgICAgICBwcm94eS51blJlZ2lzdGVyUm91dGUocm91dGUsICdHRVQnKTtcbiAgICB9KTtcbn1cbiJdfQ==