import b64 from 'btoa';
import { isSubPartOfRoute } from "./pathUtils.js";
import { capitalize } from "./stringUtils.js";
import { getNextSegmentOrLeaf, getSubRouteGroup } from "./subRouteUtils.js";
import { AutorouteOptions, ModuleBundle, Translation } from './types.js';

export class RouteTransformer {

    options? : AutorouteOptions;

    setOptions = (options:AutorouteOptions) => {
        this.options = options;
    }

    remap = (mapping: ModuleBundle[]) => {
        this.translateRoutes(mapping);
        // sorting by route alphabetically
        const sortedMapping = this.supplyMapingSortedAlphabetically(mapping)

        this.flattenMapping(sortedMapping);
        return sortedMapping;
    }

    private flattenMapping = (mapping: ModuleBundle[]) => {
        if (this.options!.flat) {
            mapping.forEach(r => {
                r.route = "/" + getSubRouteGroup(r.route).leaf
            })
        }
    }

    private supplyMapingSortedAlphabetically = (mapping: ModuleBundle[]) => {
        return mapping.sort((a: ModuleBundle, b: ModuleBundle) => a.route.localeCompare(b.route));
    }

    
    /**
     * replace specific routes by custom
     * @param mapping 
     */
    translateRoutes = (mapping: ModuleBundle[]) => {
        mapping.map(({ route }, i) => {
            this.options!.translations?.forEach(
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

    substituteAmbiguous = (mapping: ModuleBundle[], routeModule: ModuleBundle, i: number) => {
        if (routeModule.route === "/")
            return
        this.substituteWithFrame(routeModule);
        this.substituteWithCapital(routeModule)
        this.substituteWithBase64(routeModule, mapping, i)
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
    
    capitalizeLeaf = (route: string) => {
        const g = getSubRouteGroup(route);

        return g.leaf.length > 0 ? 
            `${g.branches}${capitalize(g.leaf)}` : 
            route;
    }
    
    frameRoute = (r: ModuleBundle) => {
        const { route } = r;
        const g = getSubRouteGroup(route);

        this.preframeRoute(r, g);
        this.postframeRoute(r);
    }

    preframeRoute = (r: ModuleBundle, g: { branches: string, leaf: string }) => {
        const before = this.options!.frame.before;
        if (before) {
            r.route = `${g.branches}${before + g.leaf}`
        }
    }

    postframeRoute = (r: ModuleBundle) => {
        const after = this.options!.frame.after;
        if (after) {
            r.route += after;
        }
    }

    substituteRootModules = (mapping: ModuleBundle[], routeModule: ModuleBundle, i: number) => {

        const nextSegment = getNextSegmentOrLeaf(mapping, i)
        const isSub = isSubPartOfRoute(routeModule.route, nextSegment)

        if (isSub && this.options!.subr != null) {
            this.substituteAmbiguous(mapping, routeModule, i)
        }
    }

    substituteWithCapital = (routeModule: ModuleBundle) => {
        if (this.options!.subr == "cptlz") {
            routeModule.route = this.capitalizeLeaf(routeModule.route);
        }
    }

    substituteWithFrame = (routeModule: ModuleBundle) => {
        if (this.options!.subr == "obj") {
            this.frameRoute(routeModule);
        }
    }

    substituteWithBase64 = (routeModule: ModuleBundle, mapping: ModuleBundle[], i: number) => {
        if (this.options!.subr == "b64") {
            this.setBase64SubRoute({ mapping, i, route: routeModule.route });
        }
    }

    setBase64SubRoute = ({ mapping, i, route }: { mapping: ModuleBundle[], i: number, route: string }) => {
        const m = /^(\/?(?:[^\/]+\/)*)([^\/]*)$/.exec(route)!;
        const sub: string = m[2] ? m[2] : m[1]
        mapping[i].route = (m[1] + b64(sub))
            .replace(/[=]+$/, "");
    }
}