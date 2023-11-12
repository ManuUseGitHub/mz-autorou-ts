import path from "path";
import fs from "fs"
import { ModuleBundle, RouteModule } from "./types.js";
import { exists } from "./utils.js";

export const findIndexFileAt = (dirPath: string) => {
    return ["js", "ts"].map(extension => {
        const modulePath = dirPath + "/index." + extension;
        return fs.existsSync(modulePath) ? modulePath : null
    }).filter(exists)[0]
}
export const mappRouteWithModule = (routeModules: RouteModule[], pat: string): ModuleBundle[] => {
    return routeModules.map(r => ({
        route: path.normalize(
            '/' + r.route.replace(pat, '').toLowerCase()
        ),
        modulePath: findIndexFileAt(path.normalize(r.route))!,
        module: r.module
    }));
}

export const getDirectories = (srcpath: string) => {
    return fs.readdirSync(srcpath)
        .map(file => path.join(srcpath, file))
        .filter(p => !/.*node_modules.*/.test(p)) // remove every node_modules based folder of the result
        .filter(p => fs.statSync(p).isDirectory());
}

const flatten = (lists: string[][]) => {
    const empty: string[] = [];
    return lists.reduce((a, b) => a.concat(b), empty);
}

export const getDirectoriesRecursive = (srcpath: string): string[] => {

    const directories = getDirectories(srcpath)
    return [srcpath,
        ...(flatten(directories.map(getDirectoriesRecursive)))
    ];
}

export const importIndexModule = (indexFile: string) => {
    return import(path.normalize(indexFile))
}

export const supplyRouterModuleOrNull = (module: any) => {
    const routerObject = module.router;
    
    console.log(typeof routerObject)
    
    return (!!routerObject && routerObject.name == "router") ? module : null;
}

export const isSubPartOfRoute = (route: string, next: string) => {
    return RegExp(`(${path.normalize(route)}\/?).*`)
        .test(next);
}