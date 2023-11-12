import fs from 'fs';
import path from 'path';
import b64 from 'btoa';
import { optionize, stick } from "modulopt";
import * as autorouteOptions from "./options.js";
import { AutorouteOptionsType as AutorouteOptions, RouteModule, ModuleBundle as ModuleBundle, Translation } from './types.js';
import { exists } from './utils.js';
import { findIndexFileAt, getDirectories, getDirectoriesRecursive, importIndexModule, isSubPartOfRoute, mappRouteWithModule, supplyRouterModuleOrNull } from './pathUtils.js';
import { capitalize } from './stringUtils.js';

export class Autoroute {
    options: AutorouteOptions | any = {}
    // PUBLIC -------------------------------------------------------------
    getMapping = (options: any) => {

        this.applyOptions(options as AutorouteOptions);

        //try {
        this.checkMappingPossible();

        const mapping = this.createMapping()

        this.translateRoutes(mapping);

        // sorting by route alphabetically
        const sortedMapping = this.supplyMapingSortedAlphabetically(mapping)

        this.flattenMapping(sortedMapping);

        // display available routes
        this.hintMapping(sortedMapping);
        this.linkCallBacks(sortedMapping);

        // return the mapping for further use
        return sortedMapping;
        //} catch (err) { this.options.onerr(err); }
    }

    // PRIVATE ------------------------------------------------------------
    private supplyMapingSortedAlphabetically = (mapping: ModuleBundle[]) => {
        return mapping.sort((a: ModuleBundle, b: ModuleBundle) => a.route.localeCompare(b.route));
    }

    private applyOptions(options: AutorouteOptions | any = {}) {
        if (options.rootp != undefined) {
            let rootp = options.rootp;

            // all empty-string '/' or '\' become './'
            rootp = /^(?:(?:)|\/|\\)$/.test(rootp) ? "./" : rootp;
            options.rootp = (path.normalize(process.cwd() + "/" + rootp));
        }

        stick(optionize(this, autorouteOptions.data, false), options);
    }

    private flattenMapping = (mapping: ModuleBundle[]) => {
        if (this.options.flat) {
            mapping.forEach(r => {
                r.route = "/" + this.getSubRouteGroup(r.route).leaf
            })
        }
    }

    private linkCallBacks = (mapping: ModuleBundle[]) => {
        mapping.forEach(e => this.options.onmatch(e));
    }

    private createMapping = () => {
        const directories = getDirectoriesRecursive(this.options.rootp);
        const routeModules = this.collectRoutesAndModules(directories)

        // the mapping is entries of the providen route + module path to require
        return this.replaceSubRoutes(
            mappRouteWithModule(routeModules, this.options.rootp)
        );
    }

    private collectRoutesAndModules = (directories: string[]): RouteModule[] => {
        return directories
            .map(p => path.normalize(p))

            // only get the folders with a module of a router
            .map(dirPath => {
                const module = this.isRouterModule(findIndexFileAt(dirPath)!)
                return module != null ? { route: dirPath, module } : null;
            }).filter(exists) as RouteModule[];
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

    capitalizeLeaf = (route: string) => {
        const g = this.getSubRouteGroup(route);

        if (g.leaf.length > 0) {
            route = `${g.branches}${capitalize(g.leaf)}`;
        }
    }

    setBase64SubRoute = ({ mapping, i, route }: { mapping: ModuleBundle[], i: number, route: string }) => {
        const m = /^(\/?(?:[^\/]+\/)*)([^\/]*)$/.exec(route)!;
        const sub: string = m[2] ? m[2] : m[1]
        mapping[i].route = (m[1] + b64(sub))
            .replace(/[=]+$/, "");
    }

    getSubRouteGroup = (route: string): { branches: string, leaf: string } => {
        /// [/sub/path/.../branching/][leaf]
        const m = /(?<branches>(?:\/.*\/?)?\/)(?<leaf>[^\/]*)$/
            .exec(route)

        return m ? (m.groups as { branches: string, leaf: string }) : { branches: "", leaf: "" }
    }

    frameRoute = (r: ModuleBundle) => {
        const { route } = r;
        const g = this.getSubRouteGroup(route);

        this.preframeRoute(r, g);
        this.postframeRoute(r);
    }

    preframeRoute = (r: ModuleBundle, g: { branches: string, leaf: string }) => {
        const before = this.options.frame.before;
        if (before) {
            r.route = `${g.branches}${before + g.leaf}`
        }
    }

    postframeRoute = (r: ModuleBundle) => {
        const after = this.options.frame.after;
        if (after) {
            r.route += after;
        }
    }

    replaceSubRoutes = (mapping: ModuleBundle[]) => {
        const result = mapping
            .sort((a, b) => a.route.localeCompare(b.route))
            .map((routeModule: ModuleBundle, i) => {
                this.substituteRootModules(mapping, routeModule, i)
                return routeModule;
            });
        return result;
    }

    substituteRootModules = (mapping: ModuleBundle[], routeModule: ModuleBundle, i: number) => {

        const nextSegment = this.getNextSegmentOrLeaf(mapping, i)
        const isSub = isSubPartOfRoute(routeModule.route, nextSegment)

        if (isSub && this.options.subr != null) {
            this.substituteAmbiguous(mapping, routeModule, i)
        }
    }

    getNextSegmentOrLeaf = (mapping: ModuleBundle[], i: number) => {
        return i < (mapping.length - 1) ? mapping[i + 1].route : "?";
    }

    substituteAmbiguous = (mapping: ModuleBundle[], routeModule: ModuleBundle, i: number) => {
        if (routeModule.route === "/")
            return
        this.substituteWithFrame(routeModule);
        this.substituteWithCapital(routeModule)
        this.substituteWithBase64(routeModule, mapping, i)
    }

    substituteWithCapital = (routeModule: ModuleBundle) => {
        if (this.options.subr == "cptlz") {
            this.capitalizeLeaf(routeModule.route);
        }
    }

    substituteWithFrame = (routeModule: ModuleBundle) => {
        if (this.options.subr == "obj") {
            this.frameRoute(routeModule);
        }
    }

    substituteWithBase64 = (routeModule: ModuleBundle, mapping: ModuleBundle[], i: number) => {
        if (this.options.subr == "b64") {
            this.setBase64SubRoute({ mapping, i, route: routeModule.route });
        }
    }

    /**
     * replace specific routes by custom
     * @param mapping 
     */
    translateRoutes = (mapping: ModuleBundle[]) => {
        mapping.map(({ route }, i) => {
            this.options.translations.forEach(
                (translate: Translation) => this.applyTranslation(mapping, translate, route, i)
            );
        })
    }

    applyTranslation = (mapping: ModuleBundle[], translate: Translation, route: string, i: number) => {
        if (("/" + translate.from) == route) {
            mapping[i].route = "/" + translate.to;
            return;
        }
    }

    isRouterModule = async (indexFile: string) => {
        return !indexFile ? null :
            supplyRouterModuleOrNull(await importIndexModule(indexFile));
    }

    hintMapping = (mapping: ModuleBundle[]) => {
        if (this.options.verbose) {
            console.log(`\nAUTOROUTING: routers in '${this.options.rootp}'`)
            console.log("\u21AA", mapping.map(e => e.route))
            console.log("To turn this message off, use the Autoroute with the option 'verbose:false'", "\n")
        }
    }
}