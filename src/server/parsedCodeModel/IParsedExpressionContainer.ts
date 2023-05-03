import { ParsedCode } from './parsedCode';
import { ParsedExpression } from './ParsedExpression';



export interface IParsedExpressionContainer extends ParsedCode {
  expressions: ParsedExpression[];
  initialiseVariablesMembersEtc(statement: any, parentStatement: any, child: ParsedExpression);
}
