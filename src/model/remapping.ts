'use strict';
import * as path from 'path';
import { Project } from './project';

export class Remapping {
    public context: string;
    public prefix: string;
    public target: string;
    public basePath: string;

    public isImportForThis(contractDependencyImport: string){
        if(this.context !== undefined){
            return contractDependencyImport.startsWith(this.context + ":" + this.prefix);
        }
        return contractDependencyImport.startsWith(this.prefix);
    }

    public resolveImport(contractDependencyImport: string) {
        const validImport = this.isImportForThis(contractDependencyImport);
        if (validImport && this.context == undefined) {
            return path.join(this.basePath, this.target, contractDependencyImport.substring(this.prefix.length));
        }

        if (validImport && this.context !== undefined) {
            return path.join(this.basePath, this.target, contractDependencyImport.substring((this.context + ":" + this.prefix).length));
        }
        return null;
    }
}

export function importRemappings(remappings: string, project: Project) : Array<Remapping> {
    const remappingArray = remappings.split(/\r\n|\r|\n/); //split lines
    return importRemappingArray(remappingArray, project);
}

export function importRemappingArray(remappings: string[], project: Project) : Array<Remapping> {
    const remappingsList = new Array<Remapping>();
    if(remappings !== undefined && remappings.length > 0) {
        remappings.forEach(remappingElement => {
            const remapping = new Remapping();
            //TODO / NOTE modules should be matched to packages paths
            remapping.basePath = project.projectPackage.absoluletPath;
            if(remappingElement.indexOf(':') > -1) {
                const contextAndRemapping = remappingElement.split(':');
                remapping.context = contextAndRemapping[0];
                remappingElement = contextAndRemapping[1];
            }
            if(remappingElement.indexOf('=') > -1){
                const prefixAndTarget = remappingElement.split('=');
                remapping.prefix = prefixAndTarget[0];
                remapping.target = prefixAndTarget[1];
                remappingsList.push(remapping);
            }
        });
    }
    return remappingsList;
}