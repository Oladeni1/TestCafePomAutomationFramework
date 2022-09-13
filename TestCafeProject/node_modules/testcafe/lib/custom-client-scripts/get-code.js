"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const testcafe_hammerhead_1 = require("testcafe-hammerhead");
const internal_properties_1 = __importDefault(require("../client/driver/internal-properties"));
function getCustomClientScriptCode(script) {
    return `try {
        ${(0, testcafe_hammerhead_1.processScript)(script.content)}
    }
    catch (e) {
       window['${internal_properties_1.default.testCafeDriverInstance}'].onCustomClientScriptError(e, '${script.module || ''}');
    }`;
}
exports.default = getCustomClientScriptCode;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0LWNvZGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY3VzdG9tLWNsaWVudC1zY3JpcHRzL2dldC1jb2RlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsNkRBQW9EO0FBQ3BELCtGQUF1RTtBQUd2RSxTQUF3Qix5QkFBeUIsQ0FBRSxNQUFvQjtJQUNuRSxPQUFPO1VBQ0QsSUFBQSxtQ0FBYSxFQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7OztpQkFHdEIsNkJBQW1CLENBQUMsc0JBQXNCLG9DQUFvQyxNQUFNLENBQUMsTUFBTSxJQUFJLEVBQUU7TUFDNUcsQ0FBQztBQUNQLENBQUM7QUFQRCw0Q0FPQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHByb2Nlc3NTY3JpcHQgfSBmcm9tICd0ZXN0Y2FmZS1oYW1tZXJoZWFkJztcbmltcG9ydCBJTlRFUk5BTF9QUk9QRVJUSUVTIGZyb20gJy4uL2NsaWVudC9kcml2ZXIvaW50ZXJuYWwtcHJvcGVydGllcyc7XG5pbXBvcnQgQ2xpZW50U2NyaXB0IGZyb20gJy4vY2xpZW50LXNjcmlwdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGdldEN1c3RvbUNsaWVudFNjcmlwdENvZGUgKHNjcmlwdDogQ2xpZW50U2NyaXB0KTogc3RyaW5nIHtcbiAgICByZXR1cm4gYHRyeSB7XG4gICAgICAgICR7cHJvY2Vzc1NjcmlwdChzY3JpcHQuY29udGVudCl9XG4gICAgfVxuICAgIGNhdGNoIChlKSB7XG4gICAgICAgd2luZG93Wycke0lOVEVSTkFMX1BST1BFUlRJRVMudGVzdENhZmVEcml2ZXJJbnN0YW5jZX0nXS5vbkN1c3RvbUNsaWVudFNjcmlwdEVycm9yKGUsICcke3NjcmlwdC5tb2R1bGUgfHwgJyd9Jyk7XG4gICAgfWA7XG59XG4iXX0=