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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const lodash_1 = require("lodash");
const os_family_1 = __importDefault(require("os-family"));
const api_based_1 = __importDefault(require("../../api-based"));
const compiler_1 = __importDefault(require("../es-next/compiler"));
const typescript_configuration_1 = __importDefault(require("../../../../configuration/typescript-configuration"));
const runtime_1 = require("../../../../errors/runtime");
const types_1 = require("../../../../errors/types");
const debug_1 = __importDefault(require("debug"));
const test_page_url_1 = require("../../../../api/test-page-url");
const exportble_lib_path_1 = __importDefault(require("../../exportble-lib-path"));
const disable_v8_optimization_note_1 = __importDefault(require("../../disable-v8-optimization-note"));
// NOTE: For type definitions only
const typescript_1 = __importStar(require("typescript"));
const tsFactory = typescript_1.default.factory;
function testcafeImportPathReplacer() {
    return context => {
        const visit = (node) => {
            var _a;
            // @ts-ignore
            if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.kind) === typescript_1.SyntaxKind.ImportDeclaration && node.kind === typescript_1.SyntaxKind.StringLiteral && node.text === 'testcafe')
                return tsFactory.createStringLiteral(exportble_lib_path_1.default);
            return (0, typescript_1.visitEachChild)(node, child => visit(child), context);
        };
        return node => (0, typescript_1.visitNode)(node, visit);
    };
}
function disableV8OptimizationCodeAppender() {
    return () => {
        const visit = (node) => {
            const evalStatement = tsFactory.createExpressionStatement(tsFactory.createCallExpression(tsFactory.createIdentifier('eval'), void 0, [tsFactory.createStringLiteral('')]));
            const evalStatementWithComment = (0, typescript_1.addSyntheticLeadingComment)(evalStatement, typescript_1.SyntaxKind.MultiLineCommentTrivia, disable_v8_optimization_note_1.default, true);
            // @ts-ignore
            return tsFactory.updateSourceFile(node, [...node.statements, evalStatementWithComment]);
        };
        return node => (0, typescript_1.visitNode)(node, visit);
    };
}
const DEBUG_LOGGER = (0, debug_1.default)('testcafe:compiler:typescript');
const RENAMED_DEPENDENCIES_MAP = new Map([['testcafe', exportble_lib_path_1.default]]);
const DEFAULT_TYPESCRIPT_COMPILER_PATH = 'typescript';
class TypeScriptTestFileCompiler extends api_based_1.default {
    constructor(compilerOptions, { isCompilerServiceMode, baseUrl } = {}) {
        super({ isCompilerServiceMode, baseUrl });
        // NOTE: At present, it's necessary create an instance TypeScriptTestFileCompiler
        // to collect a list of supported test file extensions.
        // So all compilers creates 2 times: first time - for collecting all supported file extensions,
        // second one - for compiling tests.
        // In future, need to rewrite 'getSupportedExtension' method as static.
        const configPath = compilerOptions && compilerOptions.configPath || null;
        this._customCompilerOptions = compilerOptions && compilerOptions.options;
        this._tsConfig = new typescript_configuration_1.default(configPath, isCompilerServiceMode);
        this._compilerPath = TypeScriptTestFileCompiler._getCompilerPath(compilerOptions);
    }
    static _getCompilerPath(compilerOptions) {
        let compilerPath = compilerOptions && compilerOptions.customCompilerModulePath;
        if (!compilerPath || compilerPath === DEFAULT_TYPESCRIPT_COMPILER_PATH)
            return DEFAULT_TYPESCRIPT_COMPILER_PATH;
        // NOTE: if the relative path to custom TypeScript compiler module is specified
        // then we will resolve the path from the root of the 'testcafe' module
        if ((0, test_page_url_1.isRelative)(compilerPath)) {
            const testcafeRootFolder = path_1.default.resolve(__dirname, '../../../../../');
            compilerPath = path_1.default.resolve(testcafeRootFolder, compilerPath);
        }
        return compilerPath;
    }
    _loadTypeScriptCompiler() {
        try {
            return require(this._compilerPath);
        }
        catch (err) {
            throw new runtime_1.GeneralError(types_1.RUNTIME_ERRORS.typeScriptCompilerLoadingError, err.message);
        }
    }
    static _normalizeFilename(filename) {
        filename = path_1.default.resolve(filename);
        if (os_family_1.default.win)
            filename = filename.toLowerCase();
        return filename;
    }
    static _getTSDefsPath() {
        return TypeScriptTestFileCompiler._normalizeFilename(path_1.default.resolve(__dirname, '../../../../../ts-defs/index.d.ts'));
    }
    _reportErrors(diagnostics) {
        // NOTE: lazy load the compiler
        const ts = this._loadTypeScriptCompiler();
        let errMsg = 'TypeScript compilation failed.\n';
        diagnostics.forEach(d => {
            const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
            const file = d.file;
            if (file && d.start !== void 0) {
                const { line, character } = file.getLineAndCharacterOfPosition(d.start);
                errMsg += `${file.fileName} (${line + 1}, ${character + 1}): `;
            }
            errMsg += `${message}\n`;
        });
        throw new Error(errMsg);
    }
    _compileCodeForTestFiles(testFilesInfo) {
        return this._tsConfig.init(this._customCompilerOptions)
            .then(() => {
            return super._compileCodeForTestFiles(testFilesInfo);
        });
    }
    _compileFilesToCache(ts, filenames) {
        const opts = this._tsConfig.getOptions();
        const program = ts.createProgram([TypeScriptTestFileCompiler.tsDefsPath, ...filenames], opts);
        DEBUG_LOGGER('version: %s', ts.version);
        DEBUG_LOGGER('options: %O', opts);
        program.getSourceFiles().forEach(sourceFile => {
            // @ts-ignore A hack to allow import globally installed TestCafe in tests
            sourceFile.renamedDependencies = RENAMED_DEPENDENCIES_MAP;
        });
        const diagnostics = ts.getPreEmitDiagnostics(program);
        if (diagnostics.length)
            this._reportErrors(diagnostics);
        // NOTE: The first argument of emit() is a source file to be compiled. If it's undefined, all files in
        // <program> will be compiled. <program> contains a file specified in createProgram() plus all its dependencies.
        // This mode is much faster than compiling files one-by-one, and it is used in the tsc CLI compiler.
        program.emit(void 0, (outputName, result, writeBOM, onError, sources) => {
            if (!sources)
                return;
            const sourcePath = TypeScriptTestFileCompiler._normalizeFilename(sources[0].fileName);
            this.cache[sourcePath] = result;
        }, void 0, void 0, {
            before: this._getTypescriptTransformers(),
        });
    }
    _getTypescriptTransformers() {
        const transformers = [testcafeImportPathReplacer()];
        if (this.isCompilerServiceMode)
            transformers.push(disableV8OptimizationCodeAppender());
        return transformers;
    }
    _precompileCode(testFilesInfo) {
        DEBUG_LOGGER('path: "%s"', this._compilerPath);
        // NOTE: lazy load the compiler
        const ts = this._loadTypeScriptCompiler();
        const filenames = testFilesInfo.map(({ filename }) => filename);
        const normalizedFilenames = filenames.map(filename => TypeScriptTestFileCompiler._normalizeFilename(filename));
        const normalizedFilenamesMap = (0, lodash_1.zipObject)(normalizedFilenames, filenames);
        const uncachedFiles = normalizedFilenames
            .filter(filename => filename !== TypeScriptTestFileCompiler.tsDefsPath && !this.cache[filename])
            .map(filename => normalizedFilenamesMap[filename]);
        if (uncachedFiles.length)
            this._compileFilesToCache(ts, uncachedFiles);
        return normalizedFilenames.map(filename => this.cache[filename]);
    }
    _getRequireCompilers() {
        return {
            '.ts': (code, filename) => this._compileCode(code, filename),
            '.tsx': (code, filename) => this._compileCode(code, filename),
            '.js': (code, filename) => compiler_1.default.prototype._compileCode.call(this, code, filename),
            '.jsx': (code, filename) => compiler_1.default.prototype._compileCode.call(this, code, filename),
        };
    }
    get canPrecompile() {
        return true;
    }
    getSupportedExtension() {
        return ['.ts', '.tsx'];
    }
}
exports.default = TypeScriptTestFileCompiler;
TypeScriptTestFileCompiler.tsDefsPath = TypeScriptTestFileCompiler._getTSDefsPath();
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvY29tcGlsZXIvdGVzdC1maWxlL2Zvcm1hdHMvdHlwZXNjcmlwdC9jb21waWxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsZ0RBQXdCO0FBQ3hCLG1DQUFtQztBQUNuQywwREFBMkI7QUFDM0IsZ0VBQTJEO0FBQzNELG1FQUF5RDtBQUN6RCxrSEFBeUY7QUFDekYsd0RBQTBEO0FBQzFELG9EQUEwRDtBQUMxRCxrREFBMEI7QUFDMUIsaUVBQTJEO0FBQzNELGtGQUEyRDtBQUMzRCxzR0FBOEU7QUFFOUUsa0NBQWtDO0FBQ2xDLHlEQVdvQjtBQU9wQixNQUFNLFNBQVMsR0FBRyxvQkFBVSxDQUFDLE9BQU8sQ0FBQztBQWNyQyxTQUFTLDBCQUEwQjtJQUMvQixPQUFPLE9BQU8sQ0FBQyxFQUFFO1FBQ2IsTUFBTSxLQUFLLEdBQVksQ0FBQyxJQUFJLEVBQXFCLEVBQUU7O1lBQy9DLGFBQWE7WUFDYixJQUFJLENBQUEsTUFBQSxJQUFJLENBQUMsTUFBTSwwQ0FBRSxJQUFJLE1BQUssdUJBQVUsQ0FBQyxpQkFBaUIsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLHVCQUFVLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVTtnQkFDeEgsT0FBTyxTQUFTLENBQUMsbUJBQW1CLENBQUMsNEJBQW1CLENBQUMsQ0FBQztZQUU5RCxPQUFPLElBQUEsMkJBQWMsRUFBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDaEUsQ0FBQyxDQUFDO1FBRUYsT0FBTyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUEsc0JBQVMsRUFBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDMUMsQ0FBQyxDQUFDO0FBQ04s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QXJLTCw2Q0FzS0M7QUFyS2tCLHFDQUFVLEdBQUcsMEJBQTBCLENBQUMsY0FBYyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHppcE9iamVjdCB9IGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgT1MgZnJvbSAnb3MtZmFtaWx5JztcbmltcG9ydCBBUElCYXNlZFRlc3RGaWxlQ29tcGlsZXJCYXNlIGZyb20gJy4uLy4uL2FwaS1iYXNlZCc7XG5pbXBvcnQgRVNOZXh0VGVzdEZpbGVDb21waWxlciBmcm9tICcuLi9lcy1uZXh0L2NvbXBpbGVyJztcbmltcG9ydCBUeXBlc2NyaXB0Q29uZmlndXJhdGlvbiBmcm9tICcuLi8uLi8uLi8uLi9jb25maWd1cmF0aW9uL3R5cGVzY3JpcHQtY29uZmlndXJhdGlvbic7XG5pbXBvcnQgeyBHZW5lcmFsRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lcnJvcnMvcnVudGltZSc7XG5pbXBvcnQgeyBSVU5USU1FX0VSUk9SUyB9IGZyb20gJy4uLy4uLy4uLy4uL2Vycm9ycy90eXBlcyc7XG5pbXBvcnQgZGVidWcgZnJvbSAnZGVidWcnO1xuaW1wb3J0IHsgaXNSZWxhdGl2ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2FwaS90ZXN0LXBhZ2UtdXJsJztcbmltcG9ydCBFWFBPUlRBQkxFX0xJQl9QQVRIIGZyb20gJy4uLy4uL2V4cG9ydGJsZS1saWItcGF0aCc7XG5pbXBvcnQgRElTQUJMRV9WOF9PUFRJTUlaQVRJT05fTk9URSBmcm9tICcuLi8uLi9kaXNhYmxlLXY4LW9wdGltaXphdGlvbi1ub3RlJztcblxuLy8gTk9URTogRm9yIHR5cGUgZGVmaW5pdGlvbnMgb25seVxuaW1wb3J0IFR5cGVTY3JpcHQsIHtcbiAgICBDb21waWxlck9wdGlvbnNWYWx1ZSxcbiAgICBTeW50YXhLaW5kLFxuICAgIFZpc2l0UmVzdWx0LFxuICAgIFZpc2l0b3IsXG4gICAgTm9kZSxcbiAgICB2aXNpdEVhY2hDaGlsZCxcbiAgICB2aXNpdE5vZGUsXG4gICAgVHJhbnNmb3JtZXJGYWN0b3J5LFxuICAgIFNvdXJjZUZpbGUsXG4gICAgYWRkU3ludGhldGljTGVhZGluZ0NvbW1lbnQsXG59IGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQgeyBEaWN0aW9uYXJ5LCBUeXBlU2NyaXB0Q29tcGlsZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29uZmlndXJhdGlvbi9pbnRlcmZhY2VzJztcbmltcG9ydCB7IE9wdGlvbmFsQ29tcGlsZXJBcmd1bWVudHMgfSBmcm9tICcuLi8uLi8uLi9pbnRlcmZhY2VzJztcblxuZGVjbGFyZSB0eXBlIFR5cGVTY3JpcHRJbnN0YW5jZSA9IHR5cGVvZiBUeXBlU2NyaXB0O1xuXG5jb25zdCB0c0ZhY3RvcnkgPSBUeXBlU2NyaXB0LmZhY3Rvcnk7XG5cbmludGVyZmFjZSBUZXN0RmlsZUluZm8ge1xuICAgIGZpbGVuYW1lOiBzdHJpbmc7XG59XG5cbmRlY2xhcmUgaW50ZXJmYWNlIFJlcXVpcmVDb21waWxlckZ1bmN0aW9uIHtcbiAgICAoY29kZTogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nKTogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgUmVxdWlyZUNvbXBpbGVycyB7XG4gICAgW2V4dGVuc2lvbjogc3RyaW5nXTogUmVxdWlyZUNvbXBpbGVyRnVuY3Rpb247XG59XG5cbmZ1bmN0aW9uIHRlc3RjYWZlSW1wb3J0UGF0aFJlcGxhY2VyPFQgZXh0ZW5kcyBOb2RlPiAoKTogVHJhbnNmb3JtZXJGYWN0b3J5PFQ+IHtcbiAgICByZXR1cm4gY29udGV4dCA9PiB7XG4gICAgICAgIGNvbnN0IHZpc2l0OiBWaXNpdG9yID0gKG5vZGUpOiBWaXNpdFJlc3VsdDxOb2RlPiA9PiB7XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBpZiAobm9kZS5wYXJlbnQ/LmtpbmQgPT09IFN5bnRheEtpbmQuSW1wb3J0RGVjbGFyYXRpb24gJiYgbm9kZS5raW5kID09PSBTeW50YXhLaW5kLlN0cmluZ0xpdGVyYWwgJiYgbm9kZS50ZXh0ID09PSAndGVzdGNhZmUnKVxuICAgICAgICAgICAgICAgIHJldHVybiB0c0ZhY3RvcnkuY3JlYXRlU3RyaW5nTGl0ZXJhbChFWFBPUlRBQkxFX0xJQl9QQVRIKTtcblxuICAgICAgICAgICAgcmV0dXJuIHZpc2l0RWFjaENoaWxkKG5vZGUsIGNoaWxkID0+IHZpc2l0KGNoaWxkKSwgY29udGV4dCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIG5vZGUgPT4gdmlzaXROb2RlKG5vZGUsIHZpc2l0KTtcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBkaXNhYmxlVjhPcHRpbWl6YXRpb25Db2RlQXBwZW5kZXI8VCBleHRlbmRzIE5vZGU+ICgpOiBUcmFuc2Zvcm1lckZhY3Rvcnk8VD4ge1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHZpc2l0OiBWaXNpdG9yID0gKG5vZGUpOiBWaXNpdFJlc3VsdDxOb2RlPiA9PiB7XG4gICAgICAgICAgICBjb25zdCBldmFsU3RhdGVtZW50ID0gdHNGYWN0b3J5LmNyZWF0ZUV4cHJlc3Npb25TdGF0ZW1lbnQodHNGYWN0b3J5LmNyZWF0ZUNhbGxFeHByZXNzaW9uKFxuICAgICAgICAgICAgICAgIHRzRmFjdG9yeS5jcmVhdGVJZGVudGlmaWVyKCdldmFsJyksXG4gICAgICAgICAgICAgICAgdm9pZCAwLFxuICAgICAgICAgICAgICAgIFt0c0ZhY3RvcnkuY3JlYXRlU3RyaW5nTGl0ZXJhbCgnJyldXG4gICAgICAgICAgICApKTtcblxuICAgICAgICAgICAgY29uc3QgZXZhbFN0YXRlbWVudFdpdGhDb21tZW50ID0gYWRkU3ludGhldGljTGVhZGluZ0NvbW1lbnQoZXZhbFN0YXRlbWVudCwgU3ludGF4S2luZC5NdWx0aUxpbmVDb21tZW50VHJpdmlhLCBESVNBQkxFX1Y4X09QVElNSVpBVElPTl9OT1RFLCB0cnVlKTtcblxuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgcmV0dXJuIHRzRmFjdG9yeS51cGRhdGVTb3VyY2VGaWxlKG5vZGUsIFsuLi5ub2RlLnN0YXRlbWVudHMsIGV2YWxTdGF0ZW1lbnRXaXRoQ29tbWVudF0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBub2RlID0+IHZpc2l0Tm9kZShub2RlLCB2aXNpdCk7XG4gICAgfTtcbn1cblxuXG5jb25zdCBERUJVR19MT0dHRVIgPSBkZWJ1ZygndGVzdGNhZmU6Y29tcGlsZXI6dHlwZXNjcmlwdCcpO1xuXG5jb25zdCBSRU5BTUVEX0RFUEVOREVOQ0lFU19NQVAgPSBuZXcgTWFwKFtbJ3Rlc3RjYWZlJywgRVhQT1JUQUJMRV9MSUJfUEFUSF1dKTtcblxuY29uc3QgREVGQVVMVF9UWVBFU0NSSVBUX0NPTVBJTEVSX1BBVEggPSAndHlwZXNjcmlwdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFR5cGVTY3JpcHRUZXN0RmlsZUNvbXBpbGVyIGV4dGVuZHMgQVBJQmFzZWRUZXN0RmlsZUNvbXBpbGVyQmFzZSB7XG4gICAgcHJpdmF0ZSBzdGF0aWMgdHNEZWZzUGF0aCA9IFR5cGVTY3JpcHRUZXN0RmlsZUNvbXBpbGVyLl9nZXRUU0RlZnNQYXRoKCk7XG5cbiAgICBwcml2YXRlIHJlYWRvbmx5IF90c0NvbmZpZzogVHlwZXNjcmlwdENvbmZpZ3VyYXRpb247XG4gICAgcHJpdmF0ZSByZWFkb25seSBfY29tcGlsZXJQYXRoOiBzdHJpbmc7XG4gICAgcHJpdmF0ZSByZWFkb25seSBfY3VzdG9tQ29tcGlsZXJPcHRpb25zPzogb2JqZWN0O1xuXG4gICAgcHVibGljIGNvbnN0cnVjdG9yIChjb21waWxlck9wdGlvbnM/OiBUeXBlU2NyaXB0Q29tcGlsZXJPcHRpb25zLCB7IGlzQ29tcGlsZXJTZXJ2aWNlTW9kZSwgYmFzZVVybCB9OiBPcHRpb25hbENvbXBpbGVyQXJndW1lbnRzID0ge30pIHtcbiAgICAgICAgc3VwZXIoeyBpc0NvbXBpbGVyU2VydmljZU1vZGUsIGJhc2VVcmwgfSk7XG5cbiAgICAgICAgLy8gTk9URTogQXQgcHJlc2VudCwgaXQncyBuZWNlc3NhcnkgY3JlYXRlIGFuIGluc3RhbmNlIFR5cGVTY3JpcHRUZXN0RmlsZUNvbXBpbGVyXG4gICAgICAgIC8vIHRvIGNvbGxlY3QgYSBsaXN0IG9mIHN1cHBvcnRlZCB0ZXN0IGZpbGUgZXh0ZW5zaW9ucy5cbiAgICAgICAgLy8gU28gYWxsIGNvbXBpbGVycyBjcmVhdGVzIDIgdGltZXM6IGZpcnN0IHRpbWUgLSBmb3IgY29sbGVjdGluZyBhbGwgc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9ucyxcbiAgICAgICAgLy8gc2Vjb25kIG9uZSAtIGZvciBjb21waWxpbmcgdGVzdHMuXG4gICAgICAgIC8vIEluIGZ1dHVyZSwgbmVlZCB0byByZXdyaXRlICdnZXRTdXBwb3J0ZWRFeHRlbnNpb24nIG1ldGhvZCBhcyBzdGF0aWMuXG5cbiAgICAgICAgY29uc3QgY29uZmlnUGF0aCA9IGNvbXBpbGVyT3B0aW9ucyAmJiBjb21waWxlck9wdGlvbnMuY29uZmlnUGF0aCB8fCBudWxsO1xuXG4gICAgICAgIHRoaXMuX2N1c3RvbUNvbXBpbGVyT3B0aW9ucyA9IGNvbXBpbGVyT3B0aW9ucyAmJiBjb21waWxlck9wdGlvbnMub3B0aW9ucztcbiAgICAgICAgdGhpcy5fdHNDb25maWcgICAgICAgICAgICAgID0gbmV3IFR5cGVzY3JpcHRDb25maWd1cmF0aW9uKGNvbmZpZ1BhdGgsIGlzQ29tcGlsZXJTZXJ2aWNlTW9kZSk7XG4gICAgICAgIHRoaXMuX2NvbXBpbGVyUGF0aCAgICAgICAgICA9IFR5cGVTY3JpcHRUZXN0RmlsZUNvbXBpbGVyLl9nZXRDb21waWxlclBhdGgoY29tcGlsZXJPcHRpb25zKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRpYyBfZ2V0Q29tcGlsZXJQYXRoIChjb21waWxlck9wdGlvbnM/OiBUeXBlU2NyaXB0Q29tcGlsZXJPcHRpb25zKTogc3RyaW5nIHtcbiAgICAgICAgbGV0IGNvbXBpbGVyUGF0aCA9IGNvbXBpbGVyT3B0aW9ucyAmJiBjb21waWxlck9wdGlvbnMuY3VzdG9tQ29tcGlsZXJNb2R1bGVQYXRoO1xuXG4gICAgICAgIGlmICghY29tcGlsZXJQYXRoIHx8IGNvbXBpbGVyUGF0aCA9PT0gREVGQVVMVF9UWVBFU0NSSVBUX0NPTVBJTEVSX1BBVEgpXG4gICAgICAgICAgICByZXR1cm4gREVGQVVMVF9UWVBFU0NSSVBUX0NPTVBJTEVSX1BBVEg7XG5cbiAgICAgICAgLy8gTk9URTogaWYgdGhlIHJlbGF0aXZlIHBhdGggdG8gY3VzdG9tIFR5cGVTY3JpcHQgY29tcGlsZXIgbW9kdWxlIGlzIHNwZWNpZmllZFxuICAgICAgICAvLyB0aGVuIHdlIHdpbGwgcmVzb2x2ZSB0aGUgcGF0aCBmcm9tIHRoZSByb290IG9mIHRoZSAndGVzdGNhZmUnIG1vZHVsZVxuICAgICAgICBpZiAoaXNSZWxhdGl2ZShjb21waWxlclBhdGgpKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXN0Y2FmZVJvb3RGb2xkZXIgPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vLi4vLi4vLi4vJyk7XG5cbiAgICAgICAgICAgIGNvbXBpbGVyUGF0aCA9IHBhdGgucmVzb2x2ZSh0ZXN0Y2FmZVJvb3RGb2xkZXIsIGNvbXBpbGVyUGF0aCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29tcGlsZXJQYXRoO1xuICAgIH1cblxuICAgIHByaXZhdGUgX2xvYWRUeXBlU2NyaXB0Q29tcGlsZXIgKCk6IFR5cGVTY3JpcHRJbnN0YW5jZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gcmVxdWlyZSh0aGlzLl9jb21waWxlclBhdGgpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEdlbmVyYWxFcnJvcihSVU5USU1FX0VSUk9SUy50eXBlU2NyaXB0Q29tcGlsZXJMb2FkaW5nRXJyb3IsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdGljIF9ub3JtYWxpemVGaWxlbmFtZSAoZmlsZW5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIGZpbGVuYW1lID0gcGF0aC5yZXNvbHZlKGZpbGVuYW1lKTtcblxuICAgICAgICBpZiAoT1Mud2luKVxuICAgICAgICAgICAgZmlsZW5hbWUgPSBmaWxlbmFtZS50b0xvd2VyQ2FzZSgpO1xuXG4gICAgICAgIHJldHVybiBmaWxlbmFtZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRpYyBfZ2V0VFNEZWZzUGF0aCAoKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIFR5cGVTY3JpcHRUZXN0RmlsZUNvbXBpbGVyLl9ub3JtYWxpemVGaWxlbmFtZShwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vLi4vLi4vLi4vdHMtZGVmcy9pbmRleC5kLnRzJykpO1xuICAgIH1cblxuICAgIHByaXZhdGUgX3JlcG9ydEVycm9ycyAoZGlhZ25vc3RpY3M6IFJlYWRvbmx5PFR5cGVTY3JpcHQuRGlhZ25vc3RpY1tdPik6IHZvaWQge1xuICAgICAgICAvLyBOT1RFOiBsYXp5IGxvYWQgdGhlIGNvbXBpbGVyXG4gICAgICAgIGNvbnN0IHRzOiBUeXBlU2NyaXB0SW5zdGFuY2UgPSB0aGlzLl9sb2FkVHlwZVNjcmlwdENvbXBpbGVyKCk7XG4gICAgICAgIGxldCBlcnJNc2cgPSAnVHlwZVNjcmlwdCBjb21waWxhdGlvbiBmYWlsZWQuXFxuJztcblxuICAgICAgICBkaWFnbm9zdGljcy5mb3JFYWNoKGQgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IHRzLmZsYXR0ZW5EaWFnbm9zdGljTWVzc2FnZVRleHQoZC5tZXNzYWdlVGV4dCwgJ1xcbicpO1xuICAgICAgICAgICAgY29uc3QgZmlsZSAgICA9IGQuZmlsZTtcblxuICAgICAgICAgICAgaWYgKGZpbGUgJiYgZC5zdGFydCAhPT0gdm9pZCAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBsaW5lLCBjaGFyYWN0ZXIgfSA9IGZpbGUuZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24oZC5zdGFydCk7XG5cbiAgICAgICAgICAgICAgICBlcnJNc2cgKz0gYCR7ZmlsZS5maWxlTmFtZX0gKCR7bGluZSArIDF9LCAke2NoYXJhY3RlciArIDF9KTogYDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZXJyTXNnICs9IGAke21lc3NhZ2V9XFxuYDtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVyck1zZyk7XG4gICAgfVxuXG4gICAgcHVibGljIF9jb21waWxlQ29kZUZvclRlc3RGaWxlcyAodGVzdEZpbGVzSW5mbzogVGVzdEZpbGVJbmZvW10pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgICAgIHJldHVybiB0aGlzLl90c0NvbmZpZy5pbml0KHRoaXMuX2N1c3RvbUNvbXBpbGVyT3B0aW9ucylcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VwZXIuX2NvbXBpbGVDb2RlRm9yVGVzdEZpbGVzKHRlc3RGaWxlc0luZm8pO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfY29tcGlsZUZpbGVzVG9DYWNoZSAodHM6IFR5cGVTY3JpcHRJbnN0YW5jZSwgZmlsZW5hbWVzOiBzdHJpbmdbXSk6IHZvaWQge1xuICAgICAgICBjb25zdCBvcHRzICAgID0gdGhpcy5fdHNDb25maWcuZ2V0T3B0aW9ucygpIGFzIERpY3Rpb25hcnk8Q29tcGlsZXJPcHRpb25zVmFsdWU+O1xuICAgICAgICBjb25zdCBwcm9ncmFtID0gdHMuY3JlYXRlUHJvZ3JhbShbVHlwZVNjcmlwdFRlc3RGaWxlQ29tcGlsZXIudHNEZWZzUGF0aCwgLi4uZmlsZW5hbWVzXSwgb3B0cyk7XG5cbiAgICAgICAgREVCVUdfTE9HR0VSKCd2ZXJzaW9uOiAlcycsIHRzLnZlcnNpb24pO1xuICAgICAgICBERUJVR19MT0dHRVIoJ29wdGlvbnM6ICVPJywgb3B0cyk7XG5cbiAgICAgICAgcHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpLmZvckVhY2goc291cmNlRmlsZSA9PiB7XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlIEEgaGFjayB0byBhbGxvdyBpbXBvcnQgZ2xvYmFsbHkgaW5zdGFsbGVkIFRlc3RDYWZlIGluIHRlc3RzXG4gICAgICAgICAgICBzb3VyY2VGaWxlLnJlbmFtZWREZXBlbmRlbmNpZXMgPSBSRU5BTUVEX0RFUEVOREVOQ0lFU19NQVA7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGRpYWdub3N0aWNzID0gdHMuZ2V0UHJlRW1pdERpYWdub3N0aWNzKHByb2dyYW0pO1xuXG4gICAgICAgIGlmIChkaWFnbm9zdGljcy5sZW5ndGgpXG4gICAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcnMoZGlhZ25vc3RpY3MpO1xuXG4gICAgICAgIC8vIE5PVEU6IFRoZSBmaXJzdCBhcmd1bWVudCBvZiBlbWl0KCkgaXMgYSBzb3VyY2UgZmlsZSB0byBiZSBjb21waWxlZC4gSWYgaXQncyB1bmRlZmluZWQsIGFsbCBmaWxlcyBpblxuICAgICAgICAvLyA8cHJvZ3JhbT4gd2lsbCBiZSBjb21waWxlZC4gPHByb2dyYW0+IGNvbnRhaW5zIGEgZmlsZSBzcGVjaWZpZWQgaW4gY3JlYXRlUHJvZ3JhbSgpIHBsdXMgYWxsIGl0cyBkZXBlbmRlbmNpZXMuXG4gICAgICAgIC8vIFRoaXMgbW9kZSBpcyBtdWNoIGZhc3RlciB0aGFuIGNvbXBpbGluZyBmaWxlcyBvbmUtYnktb25lLCBhbmQgaXQgaXMgdXNlZCBpbiB0aGUgdHNjIENMSSBjb21waWxlci5cbiAgICAgICAgcHJvZ3JhbS5lbWl0KHZvaWQgMCwgKG91dHB1dE5hbWUsIHJlc3VsdCwgd3JpdGVCT00sIG9uRXJyb3IsIHNvdXJjZXMpID0+IHtcbiAgICAgICAgICAgIGlmICghc291cmNlcylcbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIGNvbnN0IHNvdXJjZVBhdGggPSBUeXBlU2NyaXB0VGVzdEZpbGVDb21waWxlci5fbm9ybWFsaXplRmlsZW5hbWUoc291cmNlc1swXS5maWxlTmFtZSk7XG5cbiAgICAgICAgICAgIHRoaXMuY2FjaGVbc291cmNlUGF0aF0gPSByZXN1bHQ7XG4gICAgICAgIH0sIHZvaWQgMCwgdm9pZCAwLCB7XG4gICAgICAgICAgICBiZWZvcmU6IHRoaXMuX2dldFR5cGVzY3JpcHRUcmFuc2Zvcm1lcnMoKSxcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfZ2V0VHlwZXNjcmlwdFRyYW5zZm9ybWVycyAoKTogVHJhbnNmb3JtZXJGYWN0b3J5PFNvdXJjZUZpbGU+W10ge1xuICAgICAgICBjb25zdCB0cmFuc2Zvcm1lcnM6IFRyYW5zZm9ybWVyRmFjdG9yeTxTb3VyY2VGaWxlPltdID0gW3Rlc3RjYWZlSW1wb3J0UGF0aFJlcGxhY2VyKCldO1xuXG4gICAgICAgIGlmICh0aGlzLmlzQ29tcGlsZXJTZXJ2aWNlTW9kZSlcbiAgICAgICAgICAgIHRyYW5zZm9ybWVycy5wdXNoKGRpc2FibGVWOE9wdGltaXphdGlvbkNvZGVBcHBlbmRlcigpKTtcblxuICAgICAgICByZXR1cm4gdHJhbnNmb3JtZXJzO1xuICAgIH1cblxuICAgIHB1YmxpYyBfcHJlY29tcGlsZUNvZGUgKHRlc3RGaWxlc0luZm86IFRlc3RGaWxlSW5mb1tdKTogc3RyaW5nW10ge1xuICAgICAgICBERUJVR19MT0dHRVIoJ3BhdGg6IFwiJXNcIicsIHRoaXMuX2NvbXBpbGVyUGF0aCk7XG5cbiAgICAgICAgLy8gTk9URTogbGF6eSBsb2FkIHRoZSBjb21waWxlclxuICAgICAgICBjb25zdCB0czogVHlwZVNjcmlwdEluc3RhbmNlID0gdGhpcy5fbG9hZFR5cGVTY3JpcHRDb21waWxlcigpO1xuICAgICAgICBjb25zdCBmaWxlbmFtZXMgICAgICAgICAgICAgID0gdGVzdEZpbGVzSW5mby5tYXAoKHsgZmlsZW5hbWUgfSkgPT4gZmlsZW5hbWUpO1xuICAgICAgICBjb25zdCBub3JtYWxpemVkRmlsZW5hbWVzICAgID0gZmlsZW5hbWVzLm1hcChmaWxlbmFtZSA9PiBUeXBlU2NyaXB0VGVzdEZpbGVDb21waWxlci5fbm9ybWFsaXplRmlsZW5hbWUoZmlsZW5hbWUpKTtcbiAgICAgICAgY29uc3Qgbm9ybWFsaXplZEZpbGVuYW1lc01hcCA9IHppcE9iamVjdChub3JtYWxpemVkRmlsZW5hbWVzLCBmaWxlbmFtZXMpO1xuXG4gICAgICAgIGNvbnN0IHVuY2FjaGVkRmlsZXMgPSBub3JtYWxpemVkRmlsZW5hbWVzXG4gICAgICAgICAgICAuZmlsdGVyKGZpbGVuYW1lID0+IGZpbGVuYW1lICE9PSBUeXBlU2NyaXB0VGVzdEZpbGVDb21waWxlci50c0RlZnNQYXRoICYmICF0aGlzLmNhY2hlW2ZpbGVuYW1lXSlcbiAgICAgICAgICAgIC5tYXAoZmlsZW5hbWUgPT4gbm9ybWFsaXplZEZpbGVuYW1lc01hcFtmaWxlbmFtZV0pO1xuXG4gICAgICAgIGlmICh1bmNhY2hlZEZpbGVzLmxlbmd0aClcbiAgICAgICAgICAgIHRoaXMuX2NvbXBpbGVGaWxlc1RvQ2FjaGUodHMsIHVuY2FjaGVkRmlsZXMpO1xuXG4gICAgICAgIHJldHVybiBub3JtYWxpemVkRmlsZW5hbWVzLm1hcChmaWxlbmFtZSA9PiB0aGlzLmNhY2hlW2ZpbGVuYW1lXSk7XG4gICAgfVxuXG4gICAgcHVibGljIF9nZXRSZXF1aXJlQ29tcGlsZXJzICgpOiBSZXF1aXJlQ29tcGlsZXJzIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICcudHMnOiAgKGNvZGUsIGZpbGVuYW1lKSA9PiB0aGlzLl9jb21waWxlQ29kZShjb2RlLCBmaWxlbmFtZSksXG4gICAgICAgICAgICAnLnRzeCc6IChjb2RlLCBmaWxlbmFtZSkgPT4gdGhpcy5fY29tcGlsZUNvZGUoY29kZSwgZmlsZW5hbWUpLFxuICAgICAgICAgICAgJy5qcyc6ICAoY29kZSwgZmlsZW5hbWUpID0+IEVTTmV4dFRlc3RGaWxlQ29tcGlsZXIucHJvdG90eXBlLl9jb21waWxlQ29kZS5jYWxsKHRoaXMsIGNvZGUsIGZpbGVuYW1lKSxcbiAgICAgICAgICAgICcuanN4JzogKGNvZGUsIGZpbGVuYW1lKSA9PiBFU05leHRUZXN0RmlsZUNvbXBpbGVyLnByb3RvdHlwZS5fY29tcGlsZUNvZGUuY2FsbCh0aGlzLCBjb2RlLCBmaWxlbmFtZSksXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBjYW5QcmVjb21waWxlICgpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIGdldFN1cHBvcnRlZEV4dGVuc2lvbiAoKTogc3RyaW5nW10ge1xuICAgICAgICByZXR1cm4gWycudHMnLCAnLnRzeCddO1xuICAgIH1cbn1cbiJdfQ==