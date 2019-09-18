import * as vscode from 'vscode';
import { Credentials } from '../utils/types';

export async function getCredentials(): Promise<Credentials> {
        const {window} = vscode;
    try {
<<<<<<< HEAD
            let ethAddress = '0x0000000000000000000000000000000000000000';
            let password = 'trial';
            const projectConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('mythxvsc');
            console.log(projectConfiguration, 'poro');
=======
			let ethAddress = "0x0000000000000000000000000000000000000000"
			let password = "trial"
			const projectConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('mythxvsc');
>>>>>>> Fixed compilation method

            if (projectConfiguration.ethAddress && projectConfiguration.password) {
                ethAddress = projectConfiguration.ethAddress;
                password = projectConfiguration.password;
            } else {
                window.showInformationMessage('No user settings found for EthAddress and password. Using trial user');
            }

            return {
                ethAddress,
                password,
            };

    } catch (err) {
                throw new Error(`MythXvs Error with getting credentials. ${err}.`);
    }
}
