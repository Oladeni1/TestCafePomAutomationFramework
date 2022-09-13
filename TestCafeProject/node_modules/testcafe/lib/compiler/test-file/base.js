"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const test_page_url_1 = require("../../api/test-page-url");
const type_assertions_1 = require("../../errors/runtime/type-assertions");
class TestFileCompilerBase {
    constructor({ baseUrl }) {
        const escapedExt = (0, lodash_1.flatten)([this.getSupportedExtension()])
            .map(ext => (0, lodash_1.escapeRegExp)(ext))
            .join('|');
        this.supportedExtensionRe = new RegExp(`(${escapedExt})$`);
        this._ensureBaseUrl(baseUrl);
    }
    _ensureBaseUrl(url) {
        if (!url)
            return;
        this.baseUrl = url;
        (0, type_assertions_1.assertType)(type_assertions_1.is.string, '_ensureBaseUrl', 'The base URL', this.baseUrl);
        (0, test_page_url_1.assertBaseUrl)(this.baseUrl, '_ensureBaseUrl');
        this.baseUrl = (0, test_page_url_1.getUrl)(this.baseUrl);
    }
    _hasTests( /* code */) {
        throw new Error('Not implemented');
    }
    getSupportedExtension() {
        throw new Error('Not implemented');
    }
    async precompile( /* testFilesInfo */) {
        throw new Error('Not implemented');
    }
    async compile( /* code, filename */) {
        throw new Error('Not implemented');
    }
    async execute( /* compiledCode, filename */) {
        throw new Error('Not implemented');
    }
    canCompile(code, filename) {
        return this.supportedExtensionRe.test(filename);
    }
    get canPrecompile() {
        return false;
    }
    cleanUp() {
        // NOTE: Optional. Do nothing by default.
    }
}
exports.default = TestFileCompilerBase;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21waWxlci90ZXN0LWZpbGUvYmFzZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG1DQUEyRDtBQUMzRCwyREFBZ0U7QUFDaEUsMEVBQXNFO0FBRXRFLE1BQXFCLG9CQUFvQjtJQUNyQyxZQUFhLEVBQUUsT0FBTyxFQUFFO1FBQ3BCLE1BQU0sVUFBVSxHQUFHLElBQUEsZ0JBQU8sRUFBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLENBQUM7YUFDckQsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBQSxxQkFBUSxFQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQ3pCLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVmLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLFVBQVUsSUFBSSxDQUFDLENBQUM7UUFFM0QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRUQsY0FBYyxDQUFFLEdBQUc7UUFDZixJQUFJLENBQUMsR0FBRztZQUNKLE9BQU87UUFFWCxJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQztRQUVuQixJQUFBLDRCQUFVLEVBQUMsb0JBQUUsQ0FBQyxNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN0RSxJQUFBLDZCQUFhLEVBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBRTlDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBQSxzQkFBTSxFQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRUQsU0FBUyxFQUFFLFVBQVU7UUFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFFRCxxQkFBcUI7UUFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFFRCxLQUFLLENBQUMsVUFBVSxFQUFFLG1CQUFtQjtRQUNqQyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVELEtBQUssQ0FBQyxPQUFPLEVBQUUsb0JBQW9CO1FBQy9CLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU8sRUFBRSw0QkFBNEI7UUFDdkMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFFRCxVQUFVLENBQUUsSUFBSSxFQUFFLFFBQVE7UUFDdEIsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFRCxJQUFJLGFBQWE7UUFDYixPQUFPLEtBQUssQ0FBQztJQUNqQixDQUFDO0lBRUQsT0FBTztRQUNILHlDQUF5QztJQUM3QyxDQUFDO0NBQ0o7QUF0REQsdUNBc0RDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZXNjYXBlUmVnRXhwIGFzIGVzY2FwZVJlLCBmbGF0dGVuIH0gZnJvbSAnbG9kYXNoJztcbmltcG9ydCB7IGFzc2VydEJhc2VVcmwsIGdldFVybCB9IGZyb20gJy4uLy4uL2FwaS90ZXN0LXBhZ2UtdXJsJztcbmltcG9ydCB7IGFzc2VydFR5cGUsIGlzIH0gZnJvbSAnLi4vLi4vZXJyb3JzL3J1bnRpbWUvdHlwZS1hc3NlcnRpb25zJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGVzdEZpbGVDb21waWxlckJhc2Uge1xuICAgIGNvbnN0cnVjdG9yICh7IGJhc2VVcmwgfSkge1xuICAgICAgICBjb25zdCBlc2NhcGVkRXh0ID0gZmxhdHRlbihbdGhpcy5nZXRTdXBwb3J0ZWRFeHRlbnNpb24oKV0pXG4gICAgICAgICAgICAubWFwKGV4dCA9PiBlc2NhcGVSZShleHQpKVxuICAgICAgICAgICAgLmpvaW4oJ3wnKTtcblxuICAgICAgICB0aGlzLnN1cHBvcnRlZEV4dGVuc2lvblJlID0gbmV3IFJlZ0V4cChgKCR7ZXNjYXBlZEV4dH0pJGApO1xuXG4gICAgICAgIHRoaXMuX2Vuc3VyZUJhc2VVcmwoYmFzZVVybCk7XG4gICAgfVxuXG4gICAgX2Vuc3VyZUJhc2VVcmwgKHVybCkge1xuICAgICAgICBpZiAoIXVybClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLmJhc2VVcmwgPSB1cmw7XG5cbiAgICAgICAgYXNzZXJ0VHlwZShpcy5zdHJpbmcsICdfZW5zdXJlQmFzZVVybCcsICdUaGUgYmFzZSBVUkwnLCB0aGlzLmJhc2VVcmwpO1xuICAgICAgICBhc3NlcnRCYXNlVXJsKHRoaXMuYmFzZVVybCwgJ19lbnN1cmVCYXNlVXJsJyk7XG5cbiAgICAgICAgdGhpcy5iYXNlVXJsID0gZ2V0VXJsKHRoaXMuYmFzZVVybCk7XG4gICAgfVxuXG4gICAgX2hhc1Rlc3RzICgvKiBjb2RlICovKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkJyk7XG4gICAgfVxuXG4gICAgZ2V0U3VwcG9ydGVkRXh0ZW5zaW9uICgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQnKTtcbiAgICB9XG5cbiAgICBhc3luYyBwcmVjb21waWxlICgvKiB0ZXN0RmlsZXNJbmZvICovKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkJyk7XG4gICAgfVxuXG4gICAgYXN5bmMgY29tcGlsZSAoLyogY29kZSwgZmlsZW5hbWUgKi8pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQnKTtcbiAgICB9XG5cbiAgICBhc3luYyBleGVjdXRlICgvKiBjb21waWxlZENvZGUsIGZpbGVuYW1lICovKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkJyk7XG4gICAgfVxuXG4gICAgY2FuQ29tcGlsZSAoY29kZSwgZmlsZW5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3VwcG9ydGVkRXh0ZW5zaW9uUmUudGVzdChmaWxlbmFtZSk7XG4gICAgfVxuXG4gICAgZ2V0IGNhblByZWNvbXBpbGUgKCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY2xlYW5VcCAoKSB7XG4gICAgICAgIC8vIE5PVEU6IE9wdGlvbmFsLiBEbyBub3RoaW5nIGJ5IGRlZmF1bHQuXG4gICAgfVxufVxuIl19