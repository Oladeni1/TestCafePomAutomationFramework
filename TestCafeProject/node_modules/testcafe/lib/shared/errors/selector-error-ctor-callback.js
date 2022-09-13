"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCannotObtainInfoErrorCtor = exports.getNotFoundErrorCtor = exports.getInvisibleErrorCtor = void 0;
const Errors = __importStar(require("./index"));
function getInvisibleErrorCtor(elementName) {
    return !elementName ? 'ActionElementIsInvisibleError' : {
        name: 'ActionAdditionalElementIsInvisibleError',
        firstArg: elementName,
    };
}
exports.getInvisibleErrorCtor = getInvisibleErrorCtor;
function getNotFoundErrorCtor(elementName) {
    return !elementName ? 'ActionElementNotFoundError' : {
        name: 'ActionAdditionalElementNotFoundError',
        firstArg: elementName,
    };
}
exports.getNotFoundErrorCtor = getNotFoundErrorCtor;
function getCannotObtainInfoErrorCtor() {
    return 'CannotObtainInfoForElementSpecifiedBySelectorError';
}
exports.getCannotObtainInfoErrorCtor = getCannotObtainInfoErrorCtor;
function createErrorCtorCallback(errCtor) {
    // @ts-ignore
    const Error = typeof errCtor === 'string' ? Errors[errCtor] : Errors[errCtor.name];
    const firstArg = typeof errCtor === 'string' ? null : errCtor.firstArg;
    return (fn) => new Error(firstArg, fn);
}
exports.default = createErrorCtorCallback;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VsZWN0b3ItZXJyb3ItY3Rvci1jYWxsYmFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zaGFyZWQvZXJyb3JzL3NlbGVjdG9yLWVycm9yLWN0b3ItY2FsbGJhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFQSxnREFBa0M7QUFFbEMsU0FBZ0IscUJBQXFCLENBQUUsV0FBb0I7SUFDdkQsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsK0JBQStCLENBQUMsQ0FBQyxDQUFDO1FBQ3BELElBQUksRUFBTSx5Q0FBeUM7UUFDbkQsUUFBUSxFQUFFLFdBQVc7S0FDeEIsQ0FBQztBQUNOLENBQUM7QUFMRCxzREFLQztBQUVELFNBQWdCLG9CQUFvQixDQUFFLFdBQW9CO0lBQ3RELE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLDRCQUE0QixDQUFDLENBQUMsQ0FBQztRQUNqRCxJQUFJLEVBQU0sc0NBQXNDO1FBQ2hELFFBQVEsRUFBRSxXQUFXO0tBQ3hCLENBQUM7QUFDTixDQUFDO0FBTEQsb0RBS0M7QUFFRCxTQUFnQiw0QkFBNEI7SUFDeEMsT0FBTyxvREFBb0QsQ0FBQztBQUNoRSxDQUFDO0FBRkQsb0VBRUM7QUFFRCxTQUF3Qix1QkFBdUIsQ0FBRSxPQUFxQztJQUNsRixhQUFhO0lBQ2IsTUFBTSxLQUFLLEdBQU0sT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdEYsTUFBTSxRQUFRLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUM7SUFFdkUsT0FBTyxDQUFDLEVBQWlCLEVBQUUsRUFBRSxDQUFDLElBQUksS0FBSyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUMxRCxDQUFDO0FBTkQsMENBTUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBdXRvbWF0aW9uRXJyb3JDdG9yIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgRm5JbmZvLCBTZWxlY3RvckVycm9yQ2IgfSBmcm9tICcuLi8uLi9jbGllbnQvZHJpdmVyL2NvbW1hbmQtZXhlY3V0b3JzL2NsaWVudC1mdW5jdGlvbnMvdHlwZXMnO1xuaW1wb3J0ICogYXMgRXJyb3JzIGZyb20gJy4vaW5kZXgnO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW52aXNpYmxlRXJyb3JDdG9yIChlbGVtZW50TmFtZT86IHN0cmluZyk6IEF1dG9tYXRpb25FcnJvckN0b3IgfCBzdHJpbmcge1xuICAgIHJldHVybiAhZWxlbWVudE5hbWUgPyAnQWN0aW9uRWxlbWVudElzSW52aXNpYmxlRXJyb3InIDoge1xuICAgICAgICBuYW1lOiAgICAgJ0FjdGlvbkFkZGl0aW9uYWxFbGVtZW50SXNJbnZpc2libGVFcnJvcicsXG4gICAgICAgIGZpcnN0QXJnOiBlbGVtZW50TmFtZSxcbiAgICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Tm90Rm91bmRFcnJvckN0b3IgKGVsZW1lbnROYW1lPzogc3RyaW5nKTogQXV0b21hdGlvbkVycm9yQ3RvciB8IHN0cmluZyB7XG4gICAgcmV0dXJuICFlbGVtZW50TmFtZSA/ICdBY3Rpb25FbGVtZW50Tm90Rm91bmRFcnJvcicgOiB7XG4gICAgICAgIG5hbWU6ICAgICAnQWN0aW9uQWRkaXRpb25hbEVsZW1lbnROb3RGb3VuZEVycm9yJyxcbiAgICAgICAgZmlyc3RBcmc6IGVsZW1lbnROYW1lLFxuICAgIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDYW5ub3RPYnRhaW5JbmZvRXJyb3JDdG9yICgpOiBBdXRvbWF0aW9uRXJyb3JDdG9yIHwgc3RyaW5nIHtcbiAgICByZXR1cm4gJ0Nhbm5vdE9idGFpbkluZm9Gb3JFbGVtZW50U3BlY2lmaWVkQnlTZWxlY3RvckVycm9yJztcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gY3JlYXRlRXJyb3JDdG9yQ2FsbGJhY2sgKGVyckN0b3I6IEF1dG9tYXRpb25FcnJvckN0b3IgfCBzdHJpbmcpOiBTZWxlY3RvckVycm9yQ2Ige1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBFcnJvciAgICA9IHR5cGVvZiBlcnJDdG9yID09PSAnc3RyaW5nJyA/IEVycm9yc1tlcnJDdG9yXSA6IEVycm9yc1tlcnJDdG9yLm5hbWVdO1xuICAgIGNvbnN0IGZpcnN0QXJnID0gdHlwZW9mIGVyckN0b3IgPT09ICdzdHJpbmcnID8gbnVsbCA6IGVyckN0b3IuZmlyc3RBcmc7XG5cbiAgICByZXR1cm4gKGZuOiBGbkluZm8gfCBudWxsKSA9PiBuZXcgRXJyb3IoZmlyc3RBcmcsIGZuKTtcbn1cbiJdfQ==