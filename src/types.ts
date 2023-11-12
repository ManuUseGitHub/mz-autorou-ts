export type Translation = { from: string, to: string }

export type ModuleBundle = { route:string, modulePath:string , module: Promise<any>}
export type RouteModule = {
    route: string;
    module: Promise<any>;
}

export type AutorouteOptionsType = {
    flat:boolean,
    rootp:string,
    verbose:boolean,
    onmatch: (match:any) => void,
    onerr:({message}:{message:string}) => void,
    subr:null|"obj"|"cptlz"|"b64",
    frame: {before?:string,after?:string},
    translations:Translation[]
}