import { Location } from 'vscode-languageserver';
import { ParsedDocument } from './ParsedDocument';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedContract } from './parsedContract';


export class ParsedContractIs extends ParsedCode {

    private contractReference: ParsedContract = null;
    public override initialise(element: any,  document: ParsedDocument, contract: ParsedContract, isGlobal: boolean) {
        super.initialise(element, document, contract, isGlobal);
        this.name = element.name;
    }

    public initialiseContractReference(): ParsedContract {
        if (this.contractReference !== null) { return this.contractReference; }
        this.contractReference = this.document.findContractByName(this.name);
        if (this.contractReference !== undefined && this.contractReference  !== null) {
            this.contractReference.initialiseExtendContracts();
        }
        return this.contractReference;
    }

    public getContractReference(): ParsedContract {
        return this.initialiseContractReference();
    }

    public getContractReferenceLocation(): Location {
        return this.getContractReference().getLocation();
    }

    public override getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
             return [FindTypeReferenceLocationResult.create(true, this.getContractReferenceLocation())];
        }
        return [FindTypeReferenceLocationResult.create(false)];
   }

   public override getAllReferencesToThis(): FindTypeReferenceLocationResult[] {
        const results: FindTypeReferenceLocationResult[] = [];
        results.push(this.createFoundReferenceLocationResult());
        return results.concat(this.document.getAllReferencesToObject(this.getContractReference()));
    }

   public override getAllReferencesToObject(parsedCode: ParsedCode): FindTypeReferenceLocationResult[] {
        if (this.isTheSame(parsedCode)) {
            return [this.createFoundReferenceLocationResult()];
        } else {
            const reference = this.getContractReference();
            if (reference !== null && reference.isTheSame(parsedCode)) {
                return [this.createFoundReferenceLocationResult()];
            }
        }
    }
}
