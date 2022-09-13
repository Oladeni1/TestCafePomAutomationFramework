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
const lodash_1 = require("lodash");
const moment_1 = __importDefault(require("moment"));
const async_event_emitter_1 = __importDefault(require("../../utils/async-event-emitter"));
const browser_job_1 = __importDefault(require("../browser-job"));
const screenshots_1 = __importDefault(require("../../screenshots"));
const warning_log_1 = __importDefault(require("../../notifications/warning-log"));
const fixture_hook_controller_1 = __importDefault(require("../fixture-hook-controller"));
const clientScriptsRouting = __importStar(require("../../custom-client-scripts/routing"));
const videos_1 = __importDefault(require("../../video-recorder/videos"));
const phase_1 = __importDefault(require("./phase"));
class Task extends async_event_emitter_1.default {
    constructor({ tests, browserConnectionGroups, proxy, opts, runnerWarningLog, compilerService, messageBus, }) {
        super({ captureRejections: true });
        this._timeStamp = (0, moment_1.default)();
        this._phase = phase_1.default.initialized;
        this.browserConnectionGroups = browserConnectionGroups;
        this.tests = tests;
        this.opts = opts;
        this._proxy = proxy;
        this.warningLog = new warning_log_1.default(null, warning_log_1.default.createAddWarningCallback(messageBus));
        this._compilerService = compilerService;
        this._messageBus = messageBus;
        this.warningLog.copyFrom(runnerWarningLog);
        const { path, pathPattern, fullPage, thumbnails, autoTakeOnFails } = this.opts.screenshots;
        this.screenshots = new screenshots_1.default({
            enabled: !this.opts.disableScreenshots,
            path,
            pathPattern,
            fullPage,
            thumbnails,
            messageBus,
            autoTakeOnFails,
        });
        this.fixtureHookController = new fixture_hook_controller_1.default(tests, browserConnectionGroups.length);
        this._pendingBrowserJobs = this._createBrowserJobs(proxy, this.opts);
        this._clientScriptRoutes = clientScriptsRouting.register(proxy, tests);
        this.testStructure = this._prepareTestStructure(tests);
        if (this.opts.videoPath) {
            const { videoPath, videoOptions, videoEncodingOptions } = this.opts;
            this.videos = new videos_1.default(this._pendingBrowserJobs, { videoPath, videoOptions, videoEncodingOptions }, this.warningLog, this._timeStamp);
        }
    }
    _assignBrowserJobEventHandlers(job) {
        job.on('test-run-done', async (testRun) => {
            await this._messageBus.emit('test-run-done', testRun);
            if (this.opts.stopOnFirstFail && testRun.errs.length) {
                this.abort();
                await this._messageBus.emit('done');
            }
        });
        job.once('start', async (startTime) => {
            if (this._phase !== phase_1.default.started) {
                this._phase = phase_1.default.started;
                this.startTime = startTime;
                await this._messageBus.emit('start', this);
            }
        });
        job.once('done', async () => {
            await this.emit('browser-job-done', job);
            (0, lodash_1.pull)(this._pendingBrowserJobs, job);
            if (!this._pendingBrowserJobs.length) {
                this._phase = phase_1.default.done;
                await this._messageBus.emit('done');
            }
        });
        job.on('test-action-done', async (args) => {
            if (this._phase === phase_1.default.done)
                return;
            await this._messageBus.emit('test-action-done', args);
        });
    }
    _prepareTestStructure(tests) {
        const groups = (0, lodash_1.groupBy)(tests, 'fixture.id');
        return Object.keys(groups).map(fixtureId => {
            const testsByGroup = groups[fixtureId];
            const fixture = testsByGroup[0].fixture;
            return {
                fixture: {
                    id: fixture.id,
                    name: fixture.name,
                    tests: testsByGroup.map(test => {
                        return {
                            id: test.id,
                            name: test.name,
                            skip: test.skip,
                        };
                    }),
                },
            };
        });
    }
    _createBrowserJobs(proxy, opts) {
        return this.browserConnectionGroups.map(browserConnectionGroup => {
            const job = new browser_job_1.default({
                tests: this.tests,
                browserConnections: browserConnectionGroup,
                screenshots: this.screenshots,
                warningLog: this.warningLog,
                fixtureHookController: this.fixtureHookController,
                compilerService: this._compilerService,
                messageBus: this._messageBus,
                proxy,
                opts,
            });
            this._assignBrowserJobEventHandlers(job);
            browserConnectionGroup.map(bc => bc.addJob(job));
            return job;
        });
    }
    unRegisterClientScriptRouting() {
        clientScriptsRouting.unRegister(this._proxy, this._clientScriptRoutes);
    }
    // API
    abort() {
        this._pendingBrowserJobs.forEach(job => job.abort());
    }
}
exports.default = Task;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcnVubmVyL3Rhc2svaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG1DQUFpRDtBQUNqRCxvREFBNEI7QUFDNUIsMEZBQWdFO0FBQ2hFLGlFQUF3QztBQUN4QyxvRUFBNEM7QUFDNUMsa0ZBQXlEO0FBQ3pELHlGQUErRDtBQUMvRCwwRkFBNEU7QUFDNUUseUVBQWlEO0FBYWpELG9EQUFnQztBQUtoQyxNQUFxQixJQUFLLFNBQVEsNkJBQWlCO0lBa0IvQyxZQUFvQixFQUNoQixLQUFLLEVBQ0wsdUJBQXVCLEVBQ3ZCLEtBQUssRUFDTCxJQUFJLEVBQ0osZ0JBQWdCLEVBQ2hCLGVBQWUsRUFDZixVQUFVLEdBQ0g7UUFDUCxLQUFLLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRW5DLElBQUksQ0FBQyxVQUFVLEdBQWdCLElBQUEsZ0JBQU0sR0FBRSxDQUFDO1FBQ3hDLElBQUksQ0FBQyxNQUFNLEdBQW9CLGVBQVMsQ0FBQyxXQUFXLENBQUM7UUFDckQsSUFBSSxDQUFDLHVCQUF1QixHQUFHLHVCQUF1QixDQUFDO1FBQ3ZELElBQUksQ0FBQyxLQUFLLEdBQXFCLEtBQUssQ0FBQztRQUNyQyxJQUFJLENBQUMsSUFBSSxHQUFzQixJQUFJLENBQUM7UUFDcEMsSUFBSSxDQUFDLE1BQU0sR0FBb0IsS0FBSyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxVQUFVLEdBQWdCLElBQUkscUJBQVUsQ0FBQyxJQUFJLEVBQUUscUJBQVUsQ0FBQyx3QkFBd0IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQ3JHLElBQUksQ0FBQyxnQkFBZ0IsR0FBVSxlQUFlLENBQUM7UUFDL0MsSUFBSSxDQUFDLFdBQVcsR0FBZSxVQUFVLENBQUM7UUFFMUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENB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QixDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFO1lBQzdELE1BQU0sR0FBRyxHQUFHLElBQUkscUJBQVUsQ0FBQztnQkFDdkIsS0FBSyxFQUFrQixJQUFJLENBQUMsS0FBSztnQkFDakMsa0JBQWtCLEVBQUssc0JBQXNCO2dCQUM3QyxXQUFXLEVBQVksSUFBSSxDQUFDLFdBQVc7Z0JBQ3ZDLFVBQVUsRUFBYSxJQUFJLENBQUMsVUFBVTtnQkFDdEMscUJBQXFCLEVBQUUsSUFBSSxDQUFDLHFCQUFxQjtnQkFDakQsZUFBZSxFQUFRLElBQUksQ0FBQyxnQkFBZ0I7Z0JBQzVDLFVBQVUsRUFBYSxJQUFJLENBQUMsV0FBVztnQkFDdkMsS0FBSztnQkFDTCxJQUFJO2FBQ1AsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLDhCQUE4QixDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3pDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUVqRCxPQUFPLEdBQUcsQ0FBQztRQUNmLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVNLDZCQUE2QjtRQUNoQyxvQkFBb0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUMzRSxDQUFDO0lBRUQsTUFBTTtJQUNDLEtBQUs7UUFDUixJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDekQsQ0FBQztDQUNKO0FBOUpELHVCQThKQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGdyb3VwQnksIHB1bGwgYXMgcmVtb3ZlIH0gZnJvbSAnbG9kYXNoJztcbmltcG9ydCBtb21lbnQgZnJvbSAnbW9tZW50JztcbmltcG9ydCBBc3luY0V2ZW50RW1pdHRlciBmcm9tICcuLi8uLi91dGlscy9hc3luYy1ldmVudC1lbWl0dGVyJztcbmltcG9ydCBCcm93c2VySm9iIGZyb20gJy4uL2Jyb3dzZXItam9iJztcbmltcG9ydCBTY3JlZW5zaG90cyBmcm9tICcuLi8uLi9zY3JlZW5zaG90cyc7XG5pbXBvcnQgV2FybmluZ0xvZyBmcm9tICcuLi8uLi9ub3RpZmljYXRpb25zL3dhcm5pbmctbG9nJztcbmltcG9ydCBGaXh0dXJlSG9va0NvbnRyb2xsZXIgZnJvbSAnLi4vZml4dHVyZS1ob29rLWNvbnRyb2xsZXInO1xuaW1wb3J0ICogYXMgY2xpZW50U2NyaXB0c1JvdXRpbmcgZnJvbSAnLi4vLi4vY3VzdG9tLWNsaWVudC1zY3JpcHRzL3JvdXRpbmcnO1xuaW1wb3J0IFZpZGVvcyBmcm9tICcuLi8uLi92aWRlby1yZWNvcmRlci92aWRlb3MnO1xuaW1wb3J0IFRlc3RSdW4gZnJvbSAnLi4vLi4vdGVzdC1ydW4nO1xuaW1wb3J0IHsgUHJveHkgfSBmcm9tICd0ZXN0Y2FmZS1oYW1tZXJoZWFkJztcbmltcG9ydCB7IERpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2ludGVyZmFjZXMnO1xuaW1wb3J0IHtcbiAgICBBY3Rpb25FdmVudEFyZyxcbiAgICBSZXBvcnRlZFRlc3RTdHJ1Y3R1cmVJdGVtLFxuICAgIFRhc2tJbml0LFxufSBmcm9tICcuLi9pbnRlcmZhY2VzJztcblxuaW1wb3J0IEJyb3dzZXJDb25uZWN0aW9uIGZyb20gJy4uLy4uL2Jyb3dzZXIvY29ubmVjdGlvbic7XG5pbXBvcnQgVGVzdCBmcm9tICcuLi8uLi9hcGkvc3RydWN0dXJlL3Rlc3QnO1xuaW1wb3J0IHsgVmlkZW9PcHRpb25zIH0gZnJvbSAnLi4vLi4vdmlkZW8tcmVjb3JkZXIvaW50ZXJmYWNlcyc7XG5pbXBvcnQgVGFza1BoYXNlIGZyb20gJy4vcGhhc2UnO1xuaW1wb3J0IENvbXBpbGVyU2VydmljZSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9jb21waWxlci9ob3N0JztcbmltcG9ydCBGaXh0dXJlIGZyb20gJy4uLy4uL2FwaS9zdHJ1Y3R1cmUvZml4dHVyZSc7XG5pbXBvcnQgTWVzc2FnZUJ1cyBmcm9tICcuLi8uLi91dGlscy9tZXNzYWdlLWJ1cyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRhc2sgZXh0ZW5kcyBBc3luY0V2ZW50RW1pdHRlciB7XG4gICAgcHJpdmF0ZSByZWFkb25seSBfdGltZVN0YW1wOiBtb21lbnQuTW9tZW50O1xuICAgIHByaXZhdGUgX3BoYXNlOiBUYXNrUGhhc2U7XG4gICAgcHVibGljIGJyb3dzZXJDb25uZWN0aW9uR3JvdXBzOiBCcm93c2VyQ29ubmVjdGlvbltdW107XG4gICAgcHVibGljIHJlYWRvbmx5IHRlc3RzOiBUZXN0W107XG4gICAgcHVibGljIHJlYWRvbmx5IG9wdHM6IERpY3Rpb25hcnk8T3B0aW9uVmFsdWU+O1xuICAgIHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBQcm94eTtcbiAgICBwdWJsaWMgcmVhZG9ubHkgd2FybmluZ0xvZzogV2FybmluZ0xvZztcbiAgICBwdWJsaWMgcmVhZG9ubHkgc2NyZWVuc2hvdHM6IFNjcmVlbnNob3RzO1xuICAgIHB1YmxpYyByZWFkb25seSBmaXh0dXJlSG9va0NvbnRyb2xsZXI6IEZpeHR1cmVIb29rQ29udHJvbGxlcjtcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9wZW5kaW5nQnJvd3NlckpvYnM6IEJyb3dzZXJKb2JbXTtcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9jbGllbnRTY3JpcHRSb3V0ZXM6IHN0cmluZ1tdO1xuICAgIHB1YmxpYyByZWFkb25seSB0ZXN0U3RydWN0dXJlOiBSZXBvcnRlZFRlc3RTdHJ1Y3R1cmVJdGVtW107XG4gICAgcHVibGljIHJlYWRvbmx5IHZpZGVvcz86IFZpZGVvcztcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9jb21waWxlclNlcnZpY2U/OiBDb21waWxlclNlcnZpY2U7XG4gICAgcHJpdmF0ZSByZWFkb25seSBfbWVzc2FnZUJ1czogTWVzc2FnZUJ1cztcbiAgICBwdWJsaWMgc3RhcnRUaW1lPzogRGF0ZTtcblxuICAgIHB1YmxpYyBjb25zdHJ1Y3RvciAoe1xuICAgICAgICB0ZXN0cyxcbiAgICAgICAgYnJvd3NlckNvbm5lY3Rpb25Hcm91cHMsXG4gICAgICAgIHByb3h5LFxuICAgICAgICBvcHRzLFxuICAgICAgICBydW5uZXJXYXJuaW5nTG9nLFxuICAgICAgICBjb21waWxlclNlcnZpY2UsXG4gICAgICAgIG1lc3NhZ2VCdXMsXG4gICAgfTogVGFza0luaXQpIHtcbiAgICAgICAgc3VwZXIoeyBjYXB0dXJlUmVqZWN0aW9uczogdHJ1ZSB9KTtcblxuICAgICAgICB0aGlzLl90aW1lU3RhbXAgICAgICAgICAgICAgID0gbW9tZW50KCk7XG4gICAgICAgIHRoaXMuX3BoYXNlICAgICAgICAgICAgICAgICAgPSBUYXNrUGhhc2UuaW5pdGlhbGl6ZWQ7XG4gICAgICAgIHRoaXMuYnJvd3NlckNvbm5lY3Rpb25Hcm91cHMgPSBicm93c2VyQ29ubmVjdGlvbkdyb3VwcztcbiAgICAgICAgdGhpcy50ZXN0cyAgICAgICAgICAgICAgICAgICA9IHRlc3RzO1xuICAgICAgICB0aGlzLm9wdHMgICAgICAgICAgICAgICAgICAgID0gb3B0cztcbiAgICAgICAgdGhpcy5fcHJveHkgICAgICAgICAgICAgICAgICA9IHByb3h5O1xuICAgICAgICB0aGlzLndhcm5pbmdMb2cgICAgICAgICAgICAgID0gbmV3IFdhcm5pbmdMb2cobnVsbCwgV2FybmluZ0xvZy5jcmVhdGVBZGRXYXJuaW5nQ2FsbGJhY2sobWVzc2FnZUJ1cykpO1xuICAgICAgICB0aGlzLl9jb21waWxlclNlcnZpY2UgICAgICAgID0gY29tcGlsZXJTZXJ2aWNlO1xuICAgICAgICB0aGlzLl9tZXNzYWdlQnVzICAgICAgICAgICAgID0gbWVzc2FnZUJ1cztcblxuICAgICAgICB0aGlzLndhcm5pbmdMb2cuY29weUZyb20ocnVubmVyV2FybmluZ0xvZyk7XG5cbiAgICAgICAgY29uc3QgeyBwYXRoLCBwYXRoUGF0dGVybiwgZnVsbFBhZ2UsIHRodW1ibmFpbHMsIGF1dG9UYWtlT25GYWlscyB9ID0gdGhpcy5vcHRzLnNjcmVlbnNob3RzIGFzIFNjcmVlbnNob3RPcHRpb25WYWx1ZTtcblxuICAgICAgICB0aGlzLnNjcmVlbnNob3RzID0gbmV3IFNjcmVlbnNob3RzKHtcbiAgICAgICAgICAgIGVuYWJsZWQ6ICF0aGlzLm9wdHMuZGlzYWJsZVNjcmVlbnNob3RzLFxuICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgIHBhdGhQYXR0ZXJuLFxuICAgICAgICAgICAgZnVsbFBhZ2UsXG4gICAgICAgICAgICB0aHVtYm5haWxzLFxuICAgICAgICAgICAgbWVzc2FnZUJ1cyxcbiAgICAgICAgICAgIGF1dG9UYWtlT25GYWlscyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5maXh0dXJlSG9va0NvbnRyb2xsZXIgPSBuZXcgRml4dHVyZUhvb2tDb250cm9sbGVyKHRlc3RzLCBicm93c2VyQ29ubmVjdGlvbkdyb3Vwcy5sZW5ndGgpO1xuICAgICAgICB0aGlzLl9wZW5kaW5nQnJvd3NlckpvYnMgICA9IHRoaXMuX2NyZWF0ZUJyb3dzZXJKb2JzKHByb3h5LCB0aGlzLm9wdHMpO1xuICAgICAgICB0aGlzLl9jbGllbnRTY3JpcHRSb3V0ZXMgICA9IGNsaWVudFNjcmlwdHNSb3V0aW5nLnJlZ2lzdGVyKHByb3h5LCB0ZXN0cyk7XG4gICAgICAgIHRoaXMudGVzdFN0cnVjdHVyZSAgICAgICAgID0gdGhpcy5fcHJlcGFyZVRlc3RTdHJ1Y3R1cmUodGVzdHMpO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdHMudmlkZW9QYXRoKSB7XG4gICAgICAgICAgICBjb25zdCB7IHZpZGVvUGF0aCwgdmlkZW9PcHRpb25zLCB2aWRlb0VuY29kaW5nT3B0aW9ucyB9ID0gdGhpcy5vcHRzO1xuXG4gICAgICAgICAgICB0aGlzLnZpZGVvcyA9IG5ldyBWaWRlb3ModGhpcy5fcGVuZGluZ0Jyb3dzZXJKb2JzLCB7IHZpZGVvUGF0aCwgdmlkZW9PcHRpb25zLCB2aWRlb0VuY29kaW5nT3B0aW9ucyB9IGFzIHVua25vd24gYXMgVmlkZW9PcHRpb25zLCB0aGlzLndhcm5pbmdMb2csIHRoaXMuX3RpbWVTdGFtcCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIF9hc3NpZ25Ccm93c2VySm9iRXZlbnRIYW5kbGVycyAoam9iOiBCcm93c2VySm9iKTogdm9pZCB7XG4gICAgICAgIGpvYi5vbigndGVzdC1ydW4tZG9uZScsIGFzeW5jICh0ZXN0UnVuOiBUZXN0UnVuKSA9PiB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLl9tZXNzYWdlQnVzLmVtaXQoJ3Rlc3QtcnVuLWRvbmUnLCB0ZXN0UnVuKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMub3B0cy5zdG9wT25GaXJzdEZhaWwgJiYgdGVzdFJ1bi5lcnJzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWJvcnQoKTtcblxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuX21lc3NhZ2VCdXMuZW1pdCgnZG9uZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBqb2Iub25jZSgnc3RhcnQnLCBhc3luYyAoc3RhcnRUaW1lOiBEYXRlKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5fcGhhc2UgIT09IFRhc2tQaGFzZS5zdGFydGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGhhc2UgICAgPSBUYXNrUGhhc2Uuc3RhcnRlZDtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXJ0VGltZSA9IHN0YXJ0VGltZTtcblxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuX21lc3NhZ2VCdXMuZW1pdCgnc3RhcnQnLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgam9iLm9uY2UoJ2RvbmUnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmVtaXQoJ2Jyb3dzZXItam9iLWRvbmUnLCBqb2IpO1xuXG4gICAgICAgICAgICByZW1vdmUodGhpcy5fcGVuZGluZ0Jyb3dzZXJKb2JzLCBqb2IpO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3BlbmRpbmdCcm93c2VySm9icy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9waGFzZSA9IFRhc2tQaGFzZS5kb25lO1xuXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5fbWVzc2FnZUJ1cy5lbWl0KCdkb25lJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGpvYi5vbigndGVzdC1hY3Rpb24tZG9uZScsIGFzeW5jIChhcmdzOiBBY3Rpb25FdmVudEFyZykgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3BoYXNlID09PSBUYXNrUGhhc2UuZG9uZSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuX21lc3NhZ2VCdXMuZW1pdCgndGVzdC1hY3Rpb24tZG9uZScsIGFyZ3MpO1xuICAgICAgICB9KTtcblxuICAgIH1cblxuICAgIHByaXZhdGUgX3ByZXBhcmVUZXN0U3RydWN0dXJlICh0ZXN0czogVGVzdFtdKTogUmVwb3J0ZWRUZXN0U3RydWN0dXJlSXRlbVtdIHtcbiAgICAgICAgY29uc3QgZ3JvdXBzID0gZ3JvdXBCeSh0ZXN0cywgJ2ZpeHR1cmUuaWQnKTtcblxuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMoZ3JvdXBzKS5tYXAoZml4dHVyZUlkID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRlc3RzQnlHcm91cCA9IGdyb3Vwc1tmaXh0dXJlSWRdO1xuICAgICAgICAgICAgY29uc3QgZml4dHVyZSAgICAgID0gdGVzdHNCeUdyb3VwWzBdLmZpeHR1cmUgYXMgRml4dHVyZTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBmaXh0dXJlOiB7XG4gICAgICAgICAgICAgICAgICAgIGlkOiAgICBmaXh0dXJlLmlkLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiAgZml4dHVyZS5uYW1lIGFzIHN0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgdGVzdHM6IHRlc3RzQnlHcm91cC5tYXAodGVzdCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiAgIHRlc3QuaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogdGVzdC5uYW1lIGFzIHN0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBza2lwOiB0ZXN0LnNraXAsXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfY3JlYXRlQnJvd3NlckpvYnMgKHByb3h5OiBQcm94eSwgb3B0czogRGljdGlvbmFyeTxPcHRpb25WYWx1ZT4pOiBCcm93c2VySm9iW10ge1xuICAgICAgICByZXR1cm4gdGhpcy5icm93c2VyQ29ubmVjdGlvbkdyb3Vwcy5tYXAoYnJvd3NlckNvbm5lY3Rpb25Hcm91cCA9PiB7XG4gICAgICAgICAgICBjb25zdCBqb2IgPSBuZXcgQnJvd3NlckpvYih7XG4gICAgICAgICAgICAgICAgdGVzdHM6ICAgICAgICAgICAgICAgICB0aGlzLnRlc3RzLFxuICAgICAgICAgICAgICAgIGJyb3dzZXJDb25uZWN0aW9uczogICAgYnJvd3NlckNvbm5lY3Rpb25Hcm91cCxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90czogICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdHMsXG4gICAgICAgICAgICAgICAgd2FybmluZ0xvZzogICAgICAgICAgICB0aGlzLndhcm5pbmdMb2csXG4gICAgICAgICAgICAgICAgZml4dHVyZUhvb2tDb250cm9sbGVyOiB0aGlzLmZpeHR1cmVIb29rQ29udHJvbGxlcixcbiAgICAgICAgICAgICAgICBjb21waWxlclNlcnZpY2U6ICAgICAgIHRoaXMuX2NvbXBpbGVyU2VydmljZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlQnVzOiAgICAgICAgICAgIHRoaXMuX21lc3NhZ2VCdXMsXG4gICAgICAgICAgICAgICAgcHJveHksXG4gICAgICAgICAgICAgICAgb3B0cyxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLl9hc3NpZ25Ccm93c2VySm9iRXZlbnRIYW5kbGVycyhqb2IpO1xuICAgICAgICAgICAgYnJvd3NlckNvbm5lY3Rpb25Hcm91cC5tYXAoYmMgPT4gYmMuYWRkSm9iKGpvYikpO1xuXG4gICAgICAgICAgICByZXR1cm4gam9iO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgdW5SZWdpc3RlckNsaWVudFNjcmlwdFJvdXRpbmcgKCk6IHZvaWQge1xuICAgICAgICBjbGllbnRTY3JpcHRzUm91dGluZy51blJlZ2lzdGVyKHRoaXMuX3Byb3h5LCB0aGlzLl9jbGllbnRTY3JpcHRSb3V0ZXMpO1xuICAgIH1cblxuICAgIC8vIEFQSVxuICAgIHB1YmxpYyBhYm9ydCAoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuX3BlbmRpbmdCcm93c2VySm9icy5mb3JFYWNoKGpvYiA9PiBqb2IuYWJvcnQoKSk7XG4gICAgfVxufVxuIl19