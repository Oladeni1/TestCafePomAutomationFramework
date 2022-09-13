"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDiff = exports.markup = exports.shouldSkipCallsite = exports.replaceLeadingSpacesWithNbsp = exports.formatExpressionMessage = exports.formatSelectorCallstack = exports.formatUrl = exports.renderForbiddenCharsList = exports.SUBTITLES = void 0;
const dedent_1 = __importDefault(require("dedent"));
const lodash_1 = require("lodash");
const phase_1 = __importDefault(require("../../test-run/phase"));
const types_1 = require("../types");
exports.SUBTITLES = {
    [phase_1.default.initial]: '',
    [phase_1.default.inTestRunBeforeHook]: '<span class="subtitle">Error in testRun.before hook</span>\n',
    [phase_1.default.inFixtureBeforeHook]: '<span class="subtitle">Error in fixture.before hook</span>\n',
    [phase_1.default.inFixtureBeforeEachHook]: '<span class="subtitle">Error in fixture.beforeEach hook</span>\n',
    [phase_1.default.inTestBeforeHook]: '<span class="subtitle">Error in test.before hook</span>\n',
    [phase_1.default.inTest]: '',
    [phase_1.default.inTestAfterHook]: '<span class="subtitle">Error in test.after hook</span>\n',
    [phase_1.default.inFixtureAfterEachHook]: '<span class="subtitle">Error in fixture.afterEach hook</span>\n',
    [phase_1.default.inFixtureAfterHook]: '<span class="subtitle">Error in fixture.after hook</span>\n',
    [phase_1.default.inTestRunAfterHook]: '<span class="subtitle">Error in testRun.after hook</span>\n',
    [phase_1.default.inRoleInitializer]: '<span class="subtitle">Error in Role initializer</span>\n',
    [phase_1.default.inBookmarkRestore]: '<span class="subtitle">Error while restoring configuration after Role switch</span>\n',
    [phase_1.default.pendingFinalization]: '',
};
function renderForbiddenCharsList(forbiddenCharsList) {
    return forbiddenCharsList.map(charInfo => `\t"${charInfo.chars}" at index ${charInfo.index}\n`).join('');
}
exports.renderForbiddenCharsList = renderForbiddenCharsList;
function formatUrl(url) {
    return `<a href="${url}">${url}</a>`;
}
exports.formatUrl = formatUrl;
function formatSelectorCallstack(apiFnChain, apiFnIndex, viewportWidth) {
    if (typeof apiFnIndex === 'undefined')
        return '';
    const emptySpaces = 10;
    const ellipsis = '...)';
    const availableWidth = viewportWidth - emptySpaces;
    return apiFnChain.map((apiFn, index) => {
        let formattedApiFn = String.fromCharCode(160);
        formattedApiFn += index === apiFnIndex ? '>' : ' ';
        formattedApiFn += ' | ';
        formattedApiFn += index !== 0 ? '  ' : '';
        formattedApiFn += apiFn;
        if (formattedApiFn.length > availableWidth)
            return formattedApiFn.substr(0, availableWidth - emptySpaces) + ellipsis;
        return formattedApiFn;
    }).join('\n');
}
exports.formatSelectorCallstack = formatSelectorCallstack;
function formatExpressionMessage(expression, line, column) {
    const expressionStr = (0, lodash_1.escape)(expression);
    if (line === void 0 || column === void 0)
        return expressionStr;
    return `${expressionStr}\nat ${line}:${column}`;
}
exports.formatExpressionMessage = formatExpressionMessage;
function replaceLeadingSpacesWithNbsp(str) {
    return str.replace(/^ +/mg, match => {
        return (0, lodash_1.repeat)('&nbsp;', match.length);
    });
}
exports.replaceLeadingSpacesWithNbsp = replaceLeadingSpacesWithNbsp;
function shouldSkipCallsite(err) {
    return err.code === types_1.TEST_RUN_ERRORS.uncaughtNonErrorObjectInTestCode ||
        err.code === types_1.TEST_RUN_ERRORS.unhandledPromiseRejection ||
        err.code === types_1.TEST_RUN_ERRORS.uncaughtException;
}
exports.shouldSkipCallsite = shouldSkipCallsite;
function markup(err, msgMarkup, errCallsite = '') {
    msgMarkup = (0, dedent_1.default)(`${exports.SUBTITLES[err.testRunPhase]}<div class="message">${(0, dedent_1.default)(msgMarkup)}</div>`);
    const browserStr = `\n\n<strong>Browser:</strong> <span class="user-agent">${err.userAgent}</span>`;
    if (errCallsite)
        msgMarkup += `${browserStr}\n\n${errCallsite}\n`;
    else
        msgMarkup += browserStr;
    if (err.screenshotPath)
        msgMarkup += `\n<div class="screenshot-info"><strong>Screenshot:</strong> <a class="screenshot-path">${(0, lodash_1.escape)(err.screenshotPath)}</a></div>`;
    if (!shouldSkipCallsite(err)) {
        const callsiteMarkup = err.getCallsiteMarkup();
        if (callsiteMarkup)
            msgMarkup += `\n\n${callsiteMarkup}`;
    }
    return msgMarkup.replace('\t', '&nbsp;'.repeat(4));
}
exports.markup = markup;
function renderDiff(diff) {
    return diff ?
        `<span class="diff-added">+ expected</span> <span class="diff-removed">- actual</span>\n\n${diff}` : ``;
}
exports.renderDiff = renderDiff;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZXJyb3JzL3Rlc3QtcnVuL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLG9EQUE0QjtBQUM1QixtQ0FBc0Q7QUFDdEQsaUVBQWtEO0FBQ2xELG9DQUEyQztBQUU5QixRQUFBLFNBQVMsR0FBRztJQUNyQixDQUFDLGVBQWMsQ0FBQyxPQUFPLENBQUMsRUFBa0IsRUFBRTtJQUM1QyxDQUFDLGVBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFNLDhEQUE4RDtJQUN4RyxDQUFDLGVBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFNLDhEQUE4RDtJQUN4RyxDQUFDLGVBQWMsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLGtFQUFrRTtJQUM1RyxDQUFDLGVBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFTLDJEQUEyRDtJQUNyRyxDQUFDLGVBQWMsQ0FBQyxNQUFNLENBQUMsRUFBbUIsRUFBRTtJQUM1QyxDQUFDLGVBQWMsQ0FBQyxlQUFlLENBQUMsRUFBVSwwREFBMEQ7SUFDcEcsQ0FBQyxlQUFjLENBQUMsc0JBQXNCLENBQUMsRUFBRyxpRUFBaUU7SUFDM0csQ0FBQyxlQUFjLENBQUMsa0JBQWtCLENBQUMsRUFBTyw2REFBNkQ7SUFDdkcsQ0FBQyxlQUFjLENBQUMsa0JBQWtCLENBQUMsRUFBTyw2REFBNkQ7SUFDdkcsQ0FBQyxlQUFjLENBQUMsaUJBQWlCLENBQUMsRUFBUSwyREFBMkQ7SUFDckcsQ0FBQyxlQUFjLENBQUMsaUJBQWlCLENBQUMsRUFBUSx1RkFBdUY7SUFDakksQ0FBQyxlQUFjLENBQUMsbUJBQW1CLENBQUMsRUFBTSxFQUFFO0NBQy9DLENBQUM7QUFFRixTQUFnQix3QkFBd0IsQ0FBRSxrQkFBa0I7SUFDeEQsT0FBTyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxNQUFNLFFBQVEsQ0FBQyxLQUFLLGNBQWMsUUFBUSxD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O1FBRWpELFNBQVMsSUFBSSxVQUFVLENBQUM7SUFFNUIsSUFBSSxHQUFHLENBQUMsY0FBYztRQUNsQixTQUFTLElBQUksMEZBQTBGLElBQUEsZUFBVSxFQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDO0lBRXRKLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUMxQixNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUUvQyxJQUFJLGNBQWM7WUFDZCxTQUFTLElBQUksT0FBTyxjQUFjLEVBQUUsQ0FBQztLQUM1QztJQUVELE9BQU8sU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZELENBQUM7QUFyQkQsd0JBcUJDO0FBRUQsU0FBZ0IsVUFBVSxDQUFFLElBQUk7SUFDNUIsT0FBTyxJQUFJLENBQUMsQ0FBQztRQUNULDRGQUE0RixJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQ2hILENBQUM7QUFIRCxnQ0FHQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBkZWRlbnQgZnJvbSAnZGVkZW50JztcbmltcG9ydCB7IGVzY2FwZSBhcyBlc2NhcGVIdG1sLCByZXBlYXQgfSBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IFRFU1RfUlVOX1BIQVNFIGZyb20gJy4uLy4uL3Rlc3QtcnVuL3BoYXNlJztcbmltcG9ydCB7IFRFU1RfUlVOX0VSUk9SUyB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGNvbnN0IFNVQlRJVExFUyA9IHtcbiAgICBbVEVTVF9SVU5fUEhBU0UuaW5pdGlhbF06ICAgICAgICAgICAgICAgICAnJyxcbiAgICBbVEVTVF9SVU5fUEhBU0UuaW5UZXN0UnVuQmVmb3JlSG9va106ICAgICAnPHNwYW4gY2xhc3M9XCJzdWJ0aXRsZVwiPkVycm9yIGluIHRlc3RSdW4uYmVmb3JlIGhvb2s8L3NwYW4+XFxuJyxcbiAgICBbVEVTVF9SVU5fUEhBU0UuaW5GaXh0dXJlQmVmb3JlSG9va106ICAgICAnPHNwYW4gY2xhc3M9XCJzdWJ0aXRsZVwiPkVycm9yIGluIGZpeHR1cmUuYmVmb3JlIGhvb2s8L3NwYW4+XFxuJyxcbiAgICBbVEVTVF9SVU5fUEhBU0UuaW5GaXh0dXJlQmVmb3JlRWFjaEhvb2tdOiAnPHNwYW4gY2xhc3M9XCJzdWJ0aXRsZVwiPkVycm9yIGluIGZpeHR1cmUuYmVmb3JlRWFjaCBob29rPC9zcGFuPlxcbicsXG4gICAgW1RFU1RfUlVOX1BIQVNFLmluVGVzdEJlZm9yZUhvb2tdOiAgICAgICAgJzxzcGFuIGNsYXNzPVwic3VidGl0bGVcIj5FcnJvciBpbiB0ZXN0LmJlZm9yZSBob29rPC9zcGFuPlxcbicsXG4gICAgW1RFU1RfUlVOX1BIQVNFLmluVGVzdF06ICAgICAgICAgICAgICAgICAgJycsXG4gICAgW1RFU1RfUlVOX1BIQVNFLmluVGVzdEFmdGVySG9va106ICAgICAgICAgJzxzcGFuIGNsYXNzPVwic3VidGl0bGVcIj5FcnJvciBpbiB0ZXN0LmFmdGVyIGhvb2s8L3NwYW4+XFxuJyxcbiAgICBbVEVTVF9SVU5fUEhBU0UuaW5GaXh0dXJlQWZ0ZXJFYWNoSG9va106ICAnPHNwYW4gY2xhc3M9XCJzdWJ0aXRsZVwiPkVycm9yIGluIGZpeHR1cmUuYWZ0ZXJFYWNoIGhvb2s8L3NwYW4+XFxuJyxcbiAgICBbVEVTVF9SVU5fUEhBU0UuaW5GaXh0dXJlQWZ0ZXJIb29rXTogICAgICAnPHNwYW4gY2xhc3M9XCJzdWJ0aXRsZVwiPkVycm9yIGluIGZpeHR1cmUuYWZ0ZXIgaG9vazwvc3Bhbj5cXG4nLFxuICAgIFtURVNUX1JVTl9QSEFTRS5pblRlc3RSdW5BZnRlckhvb2tdOiAgICAgICc8c3BhbiBjbGFzcz1cInN1YnRpdGxlXCI+RXJyb3IgaW4gdGVzdFJ1bi5hZnRlciBob29rPC9zcGFuPlxcbicsXG4gICAgW1RFU1RfUlVOX1BIQVNFLmluUm9sZUluaXRpYWxpemVyXTogICAgICAgJzxzcGFuIGNsYXNzPVwic3VidGl0bGVcIj5FcnJvciBpbiBSb2xlIGluaXRpYWxpemVyPC9zcGFuPlxcbicsXG4gICAgW1RFU1RfUlVOX1BIQVNFLmluQm9va21hcmtSZXN0b3JlXTogICAgICAgJzxzcGFuIGNsYXNzPVwic3VidGl0bGVcIj5FcnJvciB3aGlsZSByZXN0b3JpbmcgY29uZmlndXJhdGlvbiBhZnRlciBSb2xlIHN3aXRjaDwvc3Bhbj5cXG4nLFxuICAgIFtURVNUX1JVTl9QSEFTRS5wZW5kaW5nRmluYWxpemF0aW9uXTogICAgICcnLFxufTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckZvcmJpZGRlbkNoYXJzTGlzdCAoZm9yYmlkZGVuQ2hhcnNMaXN0KSB7XG4gICAgcmV0dXJuIGZvcmJpZGRlbkNoYXJzTGlzdC5tYXAoY2hhckluZm8gPT4gYFxcdFwiJHtjaGFySW5mby5jaGFyc31cIiBhdCBpbmRleCAke2NoYXJJbmZvLmluZGV4fVxcbmApLmpvaW4oJycpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0VXJsICh1cmwpIHtcbiAgICByZXR1cm4gYDxhIGhyZWY9XCIke3VybH1cIj4ke3VybH08L2E+YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdFNlbGVjdG9yQ2FsbHN0YWNrIChhcGlGbkNoYWluLCBhcGlGbkluZGV4LCB2aWV3cG9ydFdpZHRoKSB7XG4gICAgaWYgKHR5cGVvZiBhcGlGbkluZGV4ID09PSAndW5kZWZpbmVkJylcbiAgICAgICAgcmV0dXJuICcnO1xuXG4gICAgY29uc3QgZW1wdHlTcGFjZXMgICAgPSAxMDtcbiAgICBjb25zdCBlbGxpcHNpcyAgICAgICA9ICcuLi4pJztcbiAgICBjb25zdCBhdmFpbGFibGVXaWR0aCA9IHZpZXdwb3J0V2lkdGggLSBlbXB0eVNwYWNlcztcblxuICAgIHJldHVybiBhcGlGbkNoYWluLm1hcCgoYXBpRm4sIGluZGV4KSA9PiB7XG4gICAgICAgIGxldCBmb3JtYXR0ZWRBcGlGbiA9IFN0cmluZy5mcm9tQ2hhckNvZGUoMTYwKTtcblxuICAgICAgICBmb3JtYXR0ZWRBcGlGbiArPSBpbmRleCA9PT0gYXBpRm5JbmRleCA/ICc+JyA6ICcgJztcbiAgICAgICAgZm9ybWF0dGVkQXBpRm4gKz0gJyB8ICc7XG4gICAgICAgIGZvcm1hdHRlZEFwaUZuICs9IGluZGV4ICE9PSAwID8gJyAgJyA6ICcnO1xuICAgICAgICBmb3JtYXR0ZWRBcGlGbiArPSBhcGlGbjtcblxuICAgICAgICBpZiAoZm9ybWF0dGVkQXBpRm4ubGVuZ3RoID4gYXZhaWxhYmxlV2lkdGgpXG4gICAgICAgICAgICByZXR1cm4gZm9ybWF0dGVkQXBpRm4uc3Vic3RyKDAsIGF2YWlsYWJsZVdpZHRoIC0gZW1wdHlTcGFjZXMpICsgZWxsaXBzaXM7XG5cbiAgICAgICAgcmV0dXJuIGZvcm1hdHRlZEFwaUZuO1xuICAgIH0pLmpvaW4oJ1xcbicpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RXhwcmVzc2lvbk1lc3NhZ2UgKGV4cHJlc3Npb24sIGxpbmUsIGNvbHVtbikge1xuICAgIGNvbnN0IGV4cHJlc3Npb25TdHIgPSBlc2NhcGVIdG1sKGV4cHJlc3Npb24pO1xuXG4gICAgaWYgKGxpbmUgPT09IHZvaWQgMCB8fCBjb2x1bW4gPT09IHZvaWQgMClcbiAgICAgICAgcmV0dXJuIGV4cHJlc3Npb25TdHI7XG5cbiAgICByZXR1cm4gYCR7ZXhwcmVzc2lvblN0cn1cXG5hdCAke2xpbmV9OiR7Y29sdW1ufWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXBsYWNlTGVhZGluZ1NwYWNlc1dpdGhOYnNwIChzdHIpIHtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoL14gKy9tZywgbWF0Y2ggPT4ge1xuICAgICAgICByZXR1cm4gcmVwZWF0KCcmbmJzcDsnLCBtYXRjaC5sZW5ndGgpO1xuICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkU2tpcENhbGxzaXRlIChlcnIpIHtcbiAgICByZXR1cm4gZXJyLmNvZGUgPT09IFRFU1RfUlVOX0VSUk9SUy51bmNhdWdodE5vbkVycm9yT2JqZWN0SW5UZXN0Q29kZSB8fFxuICAgICAgICAgICBlcnIuY29kZSA9PT0gVEVTVF9SVU5fRVJST1JTLnVuaGFuZGxlZFByb21pc2VSZWplY3Rpb24gfHxcbiAgICAgICAgICAgZXJyLmNvZGUgPT09IFRFU1RfUlVOX0VSUk9SUy51bmNhdWdodEV4Y2VwdGlvbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hcmt1cCAoZXJyLCBtc2dNYXJrdXAsIGVyckNhbGxzaXRlID0gJycpIHtcbiAgICBtc2dNYXJrdXAgPSBkZWRlbnQoYCR7U1VCVElUTEVTW2Vyci50ZXN0UnVuUGhhc2VdfTxkaXYgY2xhc3M9XCJtZXNzYWdlXCI+JHtkZWRlbnQobXNnTWFya3VwKX08L2Rpdj5gKTtcblxuICAgIGNvbnN0IGJyb3dzZXJTdHIgPSBgXFxuXFxuPHN0cm9uZz5Ccm93c2VyOjwvc3Ryb25nPiA8c3BhbiBjbGFzcz1cInVzZXItYWdlbnRcIj4ke2Vyci51c2VyQWdlbnR9PC9zcGFuPmA7XG5cbiAgICBpZiAoZXJyQ2FsbHNpdGUpXG4gICAgICAgIG1zZ01hcmt1cCArPSBgJHticm93c2VyU3RyfVxcblxcbiR7ZXJyQ2FsbHNpdGV9XFxuYDtcbiAgICBlbHNlXG4gICAgICAgIG1zZ01hcmt1cCArPSBicm93c2VyU3RyO1xuXG4gICAgaWYgKGVyci5zY3JlZW5zaG90UGF0aClcbiAgICAgICAgbXNnTWFya3VwICs9IGBcXG48ZGl2IGNsYXNzPVwic2NyZWVuc2hvdC1pbmZvXCI+PHN0cm9uZz5TY3JlZW5zaG90Ojwvc3Ryb25nPiA8YSBjbGFzcz1cInNjcmVlbnNob3QtcGF0aFwiPiR7ZXNjYXBlSHRtbChlcnIuc2NyZWVuc2hvdFBhdGgpfTwvYT48L2Rpdj5gO1xuXG4gICAgaWYgKCFzaG91bGRTa2lwQ2FsbHNpdGUoZXJyKSkge1xuICAgICAgICBjb25zdCBjYWxsc2l0ZU1hcmt1cCA9IGVyci5nZXRDYWxsc2l0ZU1hcmt1cCgpO1xuXG4gICAgICAgIGlmIChjYWxsc2l0ZU1hcmt1cClcbiAgICAgICAgICAgIG1zZ01hcmt1cCArPSBgXFxuXFxuJHtjYWxsc2l0ZU1hcmt1cH1gO1xuICAgIH1cblxuICAgIHJldHVybiBtc2dNYXJrdXAucmVwbGFjZSgnXFx0JywgJyZuYnNwOycucmVwZWF0KDQpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckRpZmYgKGRpZmYpIHtcbiAgICByZXR1cm4gZGlmZiA/XG4gICAgICAgIGA8c3BhbiBjbGFzcz1cImRpZmYtYWRkZWRcIj4rIGV4cGVjdGVkPC9zcGFuPiA8c3BhbiBjbGFzcz1cImRpZmYtcmVtb3ZlZFwiPi0gYWN0dWFsPC9zcGFuPlxcblxcbiR7ZGlmZn1gIDogYGA7XG59XG4iXX0=