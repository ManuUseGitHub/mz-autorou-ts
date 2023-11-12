import fs from 'fs';
import path from 'path';
import { optionize, stick } from "modulopt";
import * as autorouteOptions from "./options.js";
import { exists } from './utils.js';
import {
    AutorouteOptions,
    RouteModule,
    ModuleBundle
} from './types.js';
import {
    findIndexFileAt,
    getDirectoriesRecursive,
    importIndexModule,
    mappRouteWithModule,
    supplyRouterModuleOrNull
} from './pathUtils.js';
import { RouteTransformer } from './routeTransformer.js';

export class Autoroute {
    options: AutorouteOptions | any = {}
    transformer: RouteTransformer = new RouteTransformer();
    // PUBLIC -------------------------------------------------------------
    getMapping = async (options: any) => {

        this.applyOptions(options as AutorouteOptions);

        //try {
        this.checkMappingPossible();

        const sortedMapping = this.transformer.remap(await this.createMapping())

        // display available routes
        this.hintMapping(sortedMapping);
        this.linkCallBacks(sortedMapping);

        // return the mapping for further use
        return sortedMapping;
        //} catch (err) { this.options.onerr(err); }
    }

    // PRIVATE ------------------------------------------------------------


    private applyOptions(options: AutorouteOptions | any = {}) {
        if (options.rootp != undefined) {
            let rootp = options.rootp;

            // all empty-string '/' or '\' become './'
            rootp = /^(?:(?:)|\/|\\)$/.test(rootp) ? "./" : rootp;
            options.rootp = (path.normalize(process.cwd() + "/" + rootp));
        }

        stick(optionize(this, autorouteOptions.data, false), options);
        this.transformer.setOptions(options);
    }

    private linkCallBacks = (mapping: ModuleBundle[]) => {
        mapping.forEach(e => this.options.onmatch(e));
    }

    private createMapping = async () => {
        const directories = getDirectoriesRecursive(this.options.rootp);
        const routeModules = this.collectRoutesAndModules(directories)

        // the mapping is entries of the providen route + module path to require
        return this.transformer.replaceSubRoutes(
            mappRouteWithModule(await routeModules, this.options.rootp)
        );
    }

    private collectRoutesAndModules = async (directories: string[]): Promise<any> => {
        const toReturn: RouteModule[] = []

        await Promise.all(directories
            .map(p => path.normalize(p))

            // only get the folders with a module of a router
            .map(async dirPath => {
                const module = await this.isRouterModule(findIndexFileAt(dirPath)!)
                if(module != null)
                toReturn.push({ route: dirPath, module })
            }));

        return toReturn
    }

    isRouterModule = async (indexFile: string) => {
        if (!indexFile) {
            return null;
        }
        return !indexFile ? null :
            supplyRouterModuleOrNull(await importIndexModule(indexFile));
    }

    private checkMappingPossible = () => {
        const rootp = this.options.rootp;
        if (!fs.existsSync(rootp)) {

            throw {
                message: `\nAUTOROUTING: No direcrory matched the following root path '${rootp}' for the autoroute.` +
                    `\nTo set the root folder for the autoroute to work on , give a custom path via the option rootp like this :\n{'rootp':'<path-to-routers>'}\n`
            }
        }
    }

    private hintMapping = (mapping: ModuleBundle[]) => {
        if (this.options.verbose) {
            console.log(`\nAUTOROUTING: routers in '${this.options.rootp}'`)
            console.log("\u21AA", mapping.map(e => e.route))
            console.log("To turn this message off, use the Autoroute with the option 'verbose:false'", "\n")
        }
    }
}