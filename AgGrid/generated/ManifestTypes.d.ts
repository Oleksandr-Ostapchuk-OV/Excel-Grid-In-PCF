/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    inputData: ComponentFramework.PropertyTypes.StringProperty;
    enableRowGroupColumns: ComponentFramework.PropertyTypes.StringProperty;
    aggFuncColumns: ComponentFramework.PropertyTypes.StringProperty;
    jsonData: ComponentFramework.PropertyTypes.StringProperty;
    key: ComponentFramework.PropertyTypes.StringProperty;
}
export interface IOutputs {
    inputData?: string;
    enableRowGroupColumns?: string;
    aggFuncColumns?: string;
    jsonData?: string;
    key?: string;
}
