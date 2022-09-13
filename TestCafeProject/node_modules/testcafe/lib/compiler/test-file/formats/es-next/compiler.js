"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const load_libs_1 = __importDefault(require("../../../babel/load-libs"));
const api_based_1 = __importDefault(require("../../api-based"));
const is_flow_code_1 = __importDefault(require("./is-flow-code"));
const get_base_babel_options_1 = __importDefault(require("../../../babel/get-base-babel-options"));
const disable_v8_optimization_note_1 = __importDefault(require("../../disable-v8-optimization-note"));
const DISABLE_V8_OPTIMIZATION_CODE = `/*${disable_v8_optimization_note_1.default}*/
eval("");
`;
class ESNextTestFileCompiler extends api_based_1.default {
    static getBabelOptions(filename, code, isCompilerServiceMode) {
        const { presetStage2, presetFlow, transformRuntime, presetEnvForTestCode, presetReact, moduleResolver, proposalPrivateMethods, proposalClassProperties, } = (0, load_libs_1.default)(isCompilerServiceMode);
        const opts = Object.assign({}, get_base_babel_options_1.default, {
            presets: [presetStage2, presetEnvForTestCode, presetReact],
            plugins: [transformRuntime, moduleResolver, proposalPrivateMethods, proposalClassProperties],
            sourceMaps: 'inline',
            filename,
        });
        if ((0, is_flow_code_1.default)(code))
            opts.presets.push(presetFlow);
        return opts;
    }
    _compileCode(code, filename) {
        const { babel } = (0, load_libs_1.default)();
        if (this.cache[filename])
            return this.cache[filename];
        if (this.isCompilerServiceMode)
            code += DISABLE_V8_OPTIMIZATION_CODE;
        const opts = ESNextTestFileCompiler.getBabelOptions(filename, code, this.isCompilerServiceMode);
        const compiled = babel.transform(code, opts);
        this.cache[filename] = compiled.code;
        return compiled.code;
    }
    _getRequireCompilers() {
        return {
            '.js': (code, filename) => this._compileCode(code, filename),
            '.jsx': (code, filename) => this._compileCode(code, filename),
        };
    }
    getSupportedExtension() {
        return ['.js', '.jsx'];
    }
}
exports.default = ESNextTestFileCompiler;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvY29tcGlsZXIvdGVzdC1maWxlL2Zvcm1hdHMvZXMtbmV4dC9jb21waWxlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHlFQUFxRDtBQUNyRCxnRUFBMkQ7QUFDM0Qsa0VBQXdDO0FBQ3hDLG1HQUF1RTtBQUN2RSxzR0FBOEU7QUFFOUUsTUFBTSw0QkFBNEIsR0FDbEMsS0FBSyxzQ0FBNEI7O0NBRWhDLENBQUM7QUFFRixNQUFxQixzQkFBdUIsU0FBUSxtQkFBNEI7SUFFNUUsTUFBTSxDQUFDLGVBQWUsQ0FBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLHFCQUFxQjtRQUN6RCxNQUFNLEVBQ0YsWUFBWSxFQUNaLFVBQVUsRUFDVixnQkFBZ0IsRUFDaEIsb0JBQW9CLEVBQ3BCLFdBQVcsRUFDWCxjQUFjLEVBQ2Qsc0JBQXNCLEVBQ3RCLHVCQUF1QixHQUMxQixHQUFHLElBQUEsbUJBQWEsRUFBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBRXpDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLGdDQUFrQixFQUFFO1lBQy9DLE9BQU8sRUFBSyxDQUFDLFlBQVksRUFBRSxvQkFBb0IsRUFBRSxXQUFXLENBQUM7WUFDN0QsT0FBTyxFQUFLLENBQUMsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLHNCQUFzQixFQUFFLHVCQUF1QixDQUFDO1lBQy9GLFVBQVUsRUFBRSxRQUFRO1lBQ3BCLFFBQVE7U0FDWCxDQUFDLENBQUM7UUFFSCxJQUFJLElBQUEsc0JBQVUsRUFBQyxJQUFJLENBQUM7WUFDaEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFbEMsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVELFlBQVksQ0FBRSxJQUFJLEVBQUUsUUFBUTtRQUN4QixNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsSUFBQSxtQkFBYSxHQUFFLENBQUM7UUFFbEMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQztZQUNwQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFaEMsSUFBSSxJQUFJLENBQUMscUJBQXFCO1lBQzFCLElBQUksSUFBSSw0QkFBNEIsQ0FBQztRQUV6QyxNQUFNLElBQUksR0FBTyxzQkFBc0IsQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUNwRyxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUU3QyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7UUFFckMsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDO0lBQ3pCLENBQUM7SUFFRCxvQkFBb0I7UUFDaEIsT0FBTztZQUNILEtBQUssRUFBRyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQztZQUM3RCxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUM7U0FDaEUsQ0FBQztJQUNOLENBQUM7SUFFRCxxQkFBcUI7UUFDakIsT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztJQUMzQixDQUFDO0NBQ0o7QUF0REQseUNBc0RDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGxvYWRCYWJlbExpYnMgZnJvbSAnLi4vLi4vLi4vYmFiZWwvbG9hZC1saWJzJztcbmltcG9ydCBBUElCYXNlZFRlc3RGaWxlQ29tcGlsZXJCYXNlIGZyb20gJy4uLy4uL2FwaS1iYXNlZCc7XG5pbXBvcnQgaXNGbG93Q29kZSBmcm9tICcuL2lzLWZsb3ctY29kZSc7XG5pbXBvcnQgQkFTRV9CQUJFTF9PUFRJT05TIGZyb20gJy4uLy4uLy4uL2JhYmVsL2dldC1iYXNlLWJhYmVsLW9wdGlvbnMnO1xuaW1wb3J0IERJU0FCTEVfVjhfT1BUSU1JWkFUSU9OX05PVEUgZnJvbSAnLi4vLi4vZGlzYWJsZS12OC1vcHRpbWl6YXRpb24tbm90ZSc7XG5cbmNvbnN0IERJU0FCTEVfVjhfT1BUSU1JWkFUSU9OX0NPREUgPVxuYC8qJHtESVNBQkxFX1Y4X09QVElNSVpBVElPTl9OT1RFfSovXG5ldmFsKFwiXCIpO1xuYDtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRVNOZXh0VGVzdEZpbGVDb21waWxlciBleHRlbmRzIEFQSUJhc2VkVGVzdEZpbGVDb21waWxlckJhc2Uge1xuXG4gICAgc3RhdGljIGdldEJhYmVsT3B0aW9ucyAoZmlsZW5hbWUsIGNvZGUsIGlzQ29tcGlsZXJTZXJ2aWNlTW9kZSkge1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBwcmVzZXRTdGFnZTIsXG4gICAgICAgICAgICBwcmVzZXRGbG93LFxuICAgICAgICAgICAgdHJhbnNmb3JtUnVudGltZSxcbiAgICAgICAgICAgIHByZXNldEVudkZvclRlc3RDb2RlLFxuICAgICAgICAgICAgcHJlc2V0UmVhY3QsXG4gICAgICAgICAgICBtb2R1bGVSZXNvbHZlcixcbiAgICAgICAgICAgIHByb3Bvc2FsUHJpdmF0ZU1ldGhvZHMsXG4gICAgICAgICAgICBwcm9wb3NhbENsYXNzUHJvcGVydGllcyxcbiAgICAgICAgfSA9IGxvYWRCYWJlbExpYnMoaXNDb21waWxlclNlcnZpY2VNb2RlKTtcblxuICAgICAgICBjb25zdCBvcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgQkFTRV9CQUJFTF9PUFRJT05TLCB7XG4gICAgICAgICAgICBwcmVzZXRzOiAgICBbcHJlc2V0U3RhZ2UyLCBwcmVzZXRFbnZGb3JUZXN0Q29kZSwgcHJlc2V0UmVhY3RdLFxuICAgICAgICAgICAgcGx1Z2luczogICAgW3RyYW5zZm9ybVJ1bnRpbWUsIG1vZHVsZVJlc29sdmVyLCBwcm9wb3NhbFByaXZhdGVNZXRob2RzLCBwcm9wb3NhbENsYXNzUHJvcGVydGllc10sXG4gICAgICAgICAgICBzb3VyY2VNYXBzOiAnaW5saW5lJyxcbiAgICAgICAgICAgIGZpbGVuYW1lLFxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoaXNGbG93Q29kZShjb2RlKSlcbiAgICAgICAgICAgIG9wdHMucHJlc2V0cy5wdXNoKHByZXNldEZsb3cpO1xuXG4gICAgICAgIHJldHVybiBvcHRzO1xuICAgIH1cblxuICAgIF9jb21waWxlQ29kZSAoY29kZSwgZmlsZW5hbWUpIHtcbiAgICAgICAgY29uc3QgeyBiYWJlbCB9ID0gbG9hZEJhYmVsTGlicygpO1xuXG4gICAgICAgIGlmICh0aGlzLmNhY2hlW2ZpbGVuYW1lXSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNhY2hlW2ZpbGVuYW1lXTtcblxuICAgICAgICBpZiAodGhpcy5pc0NvbXBpbGVyU2VydmljZU1vZGUpXG4gICAgICAgICAgICBjb2RlICs9IERJU0FCTEVfVjhfT1BUSU1JWkFUSU9OX0NPREU7XG5cbiAgICAgICAgY29uc3Qgb3B0cyAgICAgPSBFU05leHRUZXN0RmlsZUNvbXBpbGVyLmdldEJhYmVsT3B0aW9ucyhmaWxlbmFtZSwgY29kZSwgdGhpcy5pc0NvbXBpbGVyU2VydmljZU1vZGUpO1xuICAgICAgICBjb25zdCBjb21waWxlZCA9IGJhYmVsLnRyYW5zZm9ybShjb2RlLCBvcHRzKTtcblxuICAgICAgICB0aGlzLmNhY2hlW2ZpbGVuYW1lXSA9IGNvbXBpbGVkLmNvZGU7XG5cbiAgICAgICAgcmV0dXJuIGNvbXBpbGVkLmNvZGU7XG4gICAgfVxuXG4gICAgX2dldFJlcXVpcmVDb21waWxlcnMgKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJy5qcyc6ICAoY29kZSwgZmlsZW5hbWUpID0+IHRoaXMuX2NvbXBpbGVDb2RlKGNvZGUsIGZpbGVuYW1lKSxcbiAgICAgICAgICAgICcuanN4JzogKGNvZGUsIGZpbGVuYW1lKSA9PiB0aGlzLl9jb21waWxlQ29kZShjb2RlLCBmaWxlbmFtZSksXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZ2V0U3VwcG9ydGVkRXh0ZW5zaW9uICgpIHtcbiAgICAgICAgcmV0dXJuIFsnLmpzJywgJy5qc3gnXTtcbiAgICB9XG59XG4iXX0=