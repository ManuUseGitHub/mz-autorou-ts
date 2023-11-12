import { ModuleBundle } from "./types.js";

export const getSubRouteGroup = (route: string): { branches: string, leaf: string } => {
    /// [/sub/path/.../branching/][leaf]
    const m = /(?<branches>(?:\/.*\/?)?\/)(?<leaf>[^\/]*)$/
        .exec(route)

    return m ? (m.groups as { branches: string, leaf: string }) : { branches: "", leaf: "" }
}

export type WithRoute = {
    route:string
}

export const getNextSegmentOrLeaf = (mapping: WithRoute[], i: number) => {
    return i < (mapping.length - 1) ? mapping[i + 1].route : "?";
}