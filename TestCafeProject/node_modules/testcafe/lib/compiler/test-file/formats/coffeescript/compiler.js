"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const coffeescript_1 = __importDefault(require("coffeescript"));
const load_libs_1 = __importDefault(require("../../../babel/load-libs"));
const compiler_js_1 = __importDefault(require("../es-next/compiler.js"));
const FIXTURE_RE = /(^|;|\s+)fixture\s*(\.|\(|'|")/;
const TEST_RE = /(^|;|\s+)test\s*/;
class CoffeeScriptTestFileCompiler extends compiler_js_1.default {
    _hasTests(code) {
        return FIXTURE_RE.test(code) && TEST_RE.test(code);
    }
    _compileCode(code, filename) {
        if (this.cache[filename])
            return this.cache[filename];
        const transpiled = coffeescript_1.default.compile(code, {
            filename,
            bare: true,
            sourceMap: true,
            inlineMap: true,
            header: false,
        });
        const { babel } = (0, load_libs_1.default)();
        const babelOptions = compiler_js_1.default.getBabelOptions(filename, code);
        const compiled = babel.transform(transpiled.js, babelOptions);
        this.cache[filename] = compiled.code;
        return compiled.code;
    }
    _getRequireCompilers() {
        return { '.coffee': (code, filename) => this._compileCode(code, filename) };
    }
    getSupportedExtension() {
        return '.coffee';
    }
}
exports.default = CoffeeScriptTestFileCompiler;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvY29tcGlsZXIvdGVzdC1maWxlL2Zvcm1hdHMvY29mZmVlc2NyaXB0L2NvbXBpbGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsZ0VBQXdDO0FBQ3hDLHlFQUFxRDtBQUNyRCx5RUFBNEQ7QUFFNUQsTUFBTSxVQUFVLEdBQUcsZ0NBQWdDLENBQUM7QUFDcEQsTUFBTSxPQUFPLEdBQU0sa0JBQWtCLENBQUM7QUFFdEMsTUFBcUIsNEJBQTZCLFNBQVEscUJBQXNCO0lBQzVFLFNBQVMsQ0FBRSxJQUFJO1FBQ1gsT0FBTyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUVELFlBQVksQ0FBRSxJQUFJLEVBQUUsUUFBUTtRQUN4QixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDO1lBQ3BCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVoQyxNQUFNLFVBQVUsR0FBRyxzQkFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7WUFDMUMsUUFBUTtZQUNSLElBQUksRUFBTyxJQUFJO1lBQ2YsU0FBUyxFQUFFLElBQUk7WUFDZixTQUFTLEVBQUUsSUFBSTtZQUNmLE1BQU0sRUFBSyxLQUFLO1NBQ25CLENBQUMsQ0FBQztRQUVILE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBTSxJQUFBLG1CQUFhLEdBQUUsQ0FBQztRQUNyQyxNQUFNLFlBQVksR0FBRyxxQkFBc0IsQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzVFLE1BQU0sUUFBUSxHQUFPLEtBQUssQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUVsRSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7UUFFckMsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDO0lBQ3pCLENBQUM7SUFFRCxvQkFBb0I7UUFDaEIsT0FBTyxFQUFFLFNBQVMsRUFBRSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUFFLENBQUM7SUFDaEYsQ0FBQztJQUVELHFCQUFxQjtRQUNqQixPQUFPLFNBQVMsQ0FBQztJQUNyQixDQUFDO0NBQ0o7QUFqQ0QsK0NBaUNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IENvZmZlZVNjcmlwdCBmcm9tICdjb2ZmZWVzY3JpcHQnO1xuaW1wb3J0IGxvYWRCYWJlbExpYnMgZnJvbSAnLi4vLi4vLi4vYmFiZWwvbG9hZC1saWJzJztcbmltcG9ydCBFU05leHRUZXN0RmlsZUNvbXBpbGVyIGZyb20gJy4uL2VzLW5leHQvY29tcGlsZXIuanMnO1xuXG5jb25zdCBGSVhUVVJFX1JFID0gLyhefDt8XFxzKylmaXh0dXJlXFxzKihcXC58XFwofCd8XCIpLztcbmNvbnN0IFRFU1RfUkUgICAgPSAvKF58O3xcXHMrKXRlc3RcXHMqLztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ29mZmVlU2NyaXB0VGVzdEZpbGVDb21waWxlciBleHRlbmRzIEVTTmV4dFRlc3RGaWxlQ29tcGlsZXIge1xuICAgIF9oYXNUZXN0cyAoY29kZSkge1xuICAgICAgICByZXR1cm4gRklYVFVSRV9SRS50ZXN0KGNvZGUpICYmIFRFU1RfUkUudGVzdChjb2RlKTtcbiAgICB9XG5cbiAgICBfY29tcGlsZUNvZGUgKGNvZGUsIGZpbGVuYW1lKSB7XG4gICAgICAgIGlmICh0aGlzLmNhY2hlW2ZpbGVuYW1lXSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNhY2hlW2ZpbGVuYW1lXTtcblxuICAgICAgICBjb25zdCB0cmFuc3BpbGVkID0gQ29mZmVlU2NyaXB0LmNvbXBpbGUoY29kZSwge1xuICAgICAgICAgICAgZmlsZW5hbWUsXG4gICAgICAgICAgICBiYXJlOiAgICAgIHRydWUsXG4gICAgICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgICAgICBpbmxpbmVNYXA6IHRydWUsXG4gICAgICAgICAgICBoZWFkZXI6ICAgIGZhbHNlLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCB7IGJhYmVsIH0gICAgPSBsb2FkQmFiZWxMaWJzKCk7XG4gICAgICAgIGNvbnN0IGJhYmVsT3B0aW9ucyA9IEVTTmV4dFRlc3RGaWxlQ29tcGlsZXIuZ2V0QmFiZWxPcHRpb25zKGZpbGVuYW1lLCBjb2RlKTtcbiAgICAgICAgY29uc3QgY29tcGlsZWQgICAgID0gYmFiZWwudHJhbnNmb3JtKHRyYW5zcGlsZWQuanMsIGJhYmVsT3B0aW9ucyk7XG5cbiAgICAgICAgdGhpcy5jYWNoZVtmaWxlbmFtZV0gPSBjb21waWxlZC5jb2RlO1xuXG4gICAgICAgIHJldHVybiBjb21waWxlZC5jb2RlO1xuICAgIH1cblxuICAgIF9nZXRSZXF1aXJlQ29tcGlsZXJzICgpIHtcbiAgICAgICAgcmV0dXJuIHsgJy5jb2ZmZWUnOiAoY29kZSwgZmlsZW5hbWUpID0+IHRoaXMuX2NvbXBpbGVDb2RlKGNvZGUsIGZpbGVuYW1lKSB9O1xuICAgIH1cblxuICAgIGdldFN1cHBvcnRlZEV4dGVuc2lvbiAoKSB7XG4gICAgICAgIHJldHVybiAnLmNvZmZlZSc7XG4gICAgfVxufVxuIl19