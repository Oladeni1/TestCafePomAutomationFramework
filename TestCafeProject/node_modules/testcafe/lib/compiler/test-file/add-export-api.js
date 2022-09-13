"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fixture_1 = __importDefault(require("../../api/structure/fixture"));
const test_1 = __importDefault(require("../../api/structure/test"));
function default_1(testFile, exportableLibExports, { isCompilerServiceMode, baseUrl, } = {}) {
    Object.defineProperty(exportableLibExports, 'fixture', {
        get: () => new fixture_1.default(testFile, baseUrl),
        configurable: true,
    });
    Object.defineProperty(exportableLibExports, 'test', {
        get: () => {
            // NOTE: After wrapping the "import { test } from 'testcafe'" statement
            // in service functions of the 'esm' module
            // the 'test' directive executed a few times before the 'fixture' directive.
            // We need to pass an additional flag to ensure correct 'Test' function loading.
            return new test_1.default(testFile, isCompilerServiceMode, baseUrl);
        },
        configurable: true,
    });
}
exports.default = default_1;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRkLWV4cG9ydC1hcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29tcGlsZXIvdGVzdC1maWxlL2FkZC1leHBvcnQtYXBpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQ0EsMEVBQWtEO0FBQ2xELG9FQUE0QztBQUc1QyxtQkFBeUIsUUFBa0IsRUFBRSxvQkFBeUIsRUFBRSxFQUNwRSxxQkFBcUIsRUFDckIsT0FBTyxNQUNvQixFQUFFO0lBQzdCLE1BQU0sQ0FBQyxjQUFjLENBQUMsb0JBQW9CLEVBQUUsU0FBUyxFQUFFO1FBQ25ELEdBQUcsRUFBVyxHQUFHLEVBQUUsQ0FBQyxJQUFJLGlCQUFPLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQztRQUNsRCxZQUFZLEVBQUUsSUFBSTtLQUNyQixDQUFDLENBQUM7SUFFSCxNQUFNLENBQUMsY0FBYyxDQUFDLG9CQUFvQixFQUFFLE1BQU0sRUFBRTtRQUNoRCxHQUFHLEVBQUUsR0FBRyxFQUFFO1lBQ04sdUVBQXVFO1lBQ3ZFLDJDQUEyQztZQUMzQyw0RUFBNEU7WUFDNUUsZ0ZBQWdGO1lBQ2hGLE9BQU8sSUFBSSxjQUFJLENBQUMsUUFBUSxFQUFFLHFCQUFxQixFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzlELENBQUM7UUFDRCxZQUFZLEVBQUUsSUFBSTtLQUNyQixDQUFDLENBQUM7QUFDUCxDQUFDO0FBbkJELDRCQW1CQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBUZXN0RmlsZSBmcm9tICcuLi8uLi9hcGkvc3RydWN0dXJlL3Rlc3QtZmlsZSc7XG5pbXBvcnQgRml4dHVyZSBmcm9tICcuLi8uLi9hcGkvc3RydWN0dXJlL2ZpeHR1cmUnO1xuaW1wb3J0IFRlc3QgZnJvbSAnLi4vLi4vYXBpL3N0cnVjdHVyZS90ZXN0JztcbmltcG9ydCB7IE9wdGlvbmFsQ29tcGlsZXJBcmd1bWVudHMgfSBmcm9tICcuLi9pbnRlcmZhY2VzJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHRlc3RGaWxlOiBUZXN0RmlsZSwgZXhwb3J0YWJsZUxpYkV4cG9ydHM6IGFueSwge1xuICAgIGlzQ29tcGlsZXJTZXJ2aWNlTW9kZSxcbiAgICBiYXNlVXJsLFxufTogT3B0aW9uYWxDb21waWxlckFyZ3VtZW50cyA9IHt9KTogdm9pZCB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydGFibGVMaWJFeHBvcnRzLCAnZml4dHVyZScsIHtcbiAgICAgICAgZ2V0OiAgICAgICAgICAoKSA9PiBuZXcgRml4dHVyZSh0ZXN0RmlsZSwgYmFzZVVybCksXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRhYmxlTGliRXhwb3J0cywgJ3Rlc3QnLCB7XG4gICAgICAgIGdldDogKCkgPT4ge1xuICAgICAgICAgICAgLy8gTk9URTogQWZ0ZXIgd3JhcHBpbmcgdGhlIFwiaW1wb3J0IHsgdGVzdCB9IGZyb20gJ3Rlc3RjYWZlJ1wiIHN0YXRlbWVudFxuICAgICAgICAgICAgLy8gaW4gc2VydmljZSBmdW5jdGlvbnMgb2YgdGhlICdlc20nIG1vZHVsZVxuICAgICAgICAgICAgLy8gdGhlICd0ZXN0JyBkaXJlY3RpdmUgZXhlY3V0ZWQgYSBmZXcgdGltZXMgYmVmb3JlIHRoZSAnZml4dHVyZScgZGlyZWN0aXZlLlxuICAgICAgICAgICAgLy8gV2UgbmVlZCB0byBwYXNzIGFuIGFkZGl0aW9uYWwgZmxhZyB0byBlbnN1cmUgY29ycmVjdCAnVGVzdCcgZnVuY3Rpb24gbG9hZGluZy5cbiAgICAgICAgICAgIHJldHVybiBuZXcgVGVzdCh0ZXN0RmlsZSwgaXNDb21waWxlclNlcnZpY2VNb2RlLCBiYXNlVXJsKTtcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIH0pO1xufVxuIl19