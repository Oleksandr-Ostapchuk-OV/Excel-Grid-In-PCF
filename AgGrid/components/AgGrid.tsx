/*
 * MyAgGridComponent.tsx
 * Description: React component for displaying data using Ag Grid in TypeScript - Modified for OVV account reconciliation uses
 * Author: Dixit Joshi
 * Modified by: Oleksandr Ostapchuk
 * Version: 1.2.0.1
 * License: MIT
 */

import React, { useState, useEffect, useMemo, useRef} from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, CellValueChangedEvent } from 'ag-grid-community'; // Correct import for column definitions
import 'ag-grid-community/styles/ag-grid.css'; // Core CSS
import 'ag-grid-community/styles/ag-theme-quartz.css'; // Theme CSS
import 'ag-grid-community/styles/ag-theme-alpine.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import 'ag-grid-enterprise';
import Theme from './Theme';
import {option} from './Theme';
import '../css/grid.css'
import { IInputs } from '../generated/ManifestTypes';
import styled from 'styled-components';
import { ExcelExportModule, LicenseManager } from 'ag-grid-enterprise';
import { GridApi, ValueFormatterParams } from 'ag-grid-community';

interface MyAgGridProps {
    inputData: string | null;
    enableRowGroupColumns: string | null;
    pivotColumns: string | null;
    aggFuncColumns: string | null;
    onDataChange: (data: any) => void;
    height: number;
    gridLock: string;
}

const Button = styled.button`
    background-color: #BD472A; /* OVV Rust */
    color: white;
    padding: 5px 15px;
    border-radius: 0px;
    outline: 0;
    box-shadow: 0px 2px 2px rgba(0, 0, 0, 0.3);
    cusor: pointer;
    transition: ease background-color 250ms;
    &:hover {
        background-color: #6A2817; /* OVV Dark Rust */
    }
    `;

const AltButton = styled.button`
    background-color: #9E9E9E; 
    color: white;
    padding: 5px 15px;
    border-radius: 0px;
    outline: 0;
    box-shadow: 0px 2px 2px rgba(0, 0, 0, 0.3);
    cusor: pointer;
    transition: ease background-color 250ms;
    &:hover {
        background-color: #616161;
    }
    `;

const InputContainer = styled.div`
    display: flex; /* Use flexbox to align items in a row */
    align-items: center; /* Center items vertically */
`;

const Input = styled.input`
    width: 120px;  /* Set the width of the input field */
    margin-right: 10px; /* Add margin to the right for spacing */
`;

    function currencyFormatter(params: ValueFormatterParams) {
        const value = params.value;
        if (isNaN(value)) {
            return "";
        }
        if(value < 0) {
            return '(' + Math.abs(value).toString() + ')';
        } else {
            return value.toString();
        }
    }

    function amountComparator(value1: string, value2: string) {
        const value1Number = amountToComparableNumber(value1);
        const value2Number = amountToComparableNumber(value2);
        if (value1Number === null && value2Number === null) {
            return 0;
        }
        if (value1Number === null) {
            return -1;
        }
        if (value2Number === null) {
            return 1;
        }

        return value1Number - value2Number;
    }

    function amountToComparableNumber(amount: string) {
        if (amount === null || amount === undefined || amount === '') {
            return null;
        }
        if (amount.startsWith('(') && amount.endsWith(')')) {
            return -1 * Number(amount.substring(1, amount.length - 1));
        } else {
            return Number(amount);
        }
    }

      /**
         * If test mode is on and there's no "Original" record in Comments yet,
         * store the original amount in the row's Comments field.
         */
    function storeOriginalAmountInComments(row: any, originalAmount: number) {
        const testMode = false; // Set to false to disable
        if (!testMode) return; // No action if testMode is off
        const comments: string = row.Comments || '';
        if (!comments.includes('Original:')) {
          row.Comments = `Original: ${originalAmount}   ${comments}`;
        } 
      }

    const AgGrid: React.FC<MyAgGridProps> = React.memo(({ inputData, enableRowGroupColumns, pivotColumns, aggFuncColumns, onDataChange, height, gridLock}) => {
    console.log('AG Grid')
    const [divClass, setDivClass] = useState('ag-theme-alpine');
    const [selectedOption, setSelectedOption] = useState<string>('');
    const [rowData, setRowData] = useState<any[]>([]);
    const [autoDefName, setAutoDefName] = useState("athlete");
    // const [columnDefs, setColumnDefs] = useState([]); // removed to use ColDef type
    const [transferAmount, setTransferAmount] = useState<number | null>(null);
    const [columnDefs, setColumnDefs] = useState<ColDef[]>([]); // Specify type for columnDefs
    const gridRef = useRef<AgGridReact>(null);
    const updateCounter = useRef(0); // Initialize updateCounter as a useRef
    const splitCounter = useRef(0);
    const alreadyUpdatedRows = useRef<Set<string>>(new Set());
    
    // Generates unique IDs for updated rows  
    function getUpdatedFactRecID(baseFactRecID: string): string {
        if (baseFactRecID.startsWith('New-') || baseFactRecID.startsWith('Updated-')) {
            return baseFactRecID; // Preserve existing "New-" or "Updated-" IDs
        }
        updateCounter.current++; // Increment the updateCounter reference
        // updateCounter++;
        return `Updated-${updateCounter.current}-${baseFactRecID}`;
    }

    /**
     * Generates a unique FactRecID for the new row.
     * Example: if the base is '8edc...', returns 'New-1-8edc...' the first time,
     * then 'New-2-8edc...' the next time, etc.
     */
    // -- Unique ID counter to avoid duplicates --
    function getNextFactRecID(baseFactRecID: string): string {
        splitCounter.current++;
        // If it was already something like "New-5-xxx", remove the "New-5-" portion:
        const base = baseFactRecID.replace(/^New-\d+-/, '');
        return `New-${splitCounter.current}-${base}`;
      }
    
    useEffect(() => {
        const fetchData = async () => {
            let data: any = [];
            if (inputData) {
                try {
                    data = JSON.parse(inputData);
                }catch(error) {
                    console.error('Error parsing collection data:', error);
                }
            }
            // const response = await fetch('https://www.ag-grid.com/example-assets/olympic-winners.json');
            try {
                //const response = await fetch(`${apiUrl}`);
                setRowData(data);
            } catch (error) {
                setRowData([]);
                console.log('error')
            }

            if (data && data.length > 0) {
                const headers = Object.keys(data[0]);
                setAutoDefName(headers[0]);

                const aggFunc: string[] = aggFuncColumns?.split(";") || [];

                const columnTypes: any = {
                    currency: {
                        valueFormatter: currencyFormatter
                    }
                };
                const dynamicColumnDefs: ColDef<any>[] = headers.map(header => {
                    // Define common cellClassRules for all columns.
                    const baseCol: ColDef<any> = {
                        field: header,
                        floatingFilter: true,
                        cellClassRules: {
                        'new-row': (params) => params.data.FactRecID?.startsWith("New-"),
                        'updated-row': (params) => params.data.FactRecID?.startsWith("Updated-")
                        }
                    };

                    // For the ServiceDate column, force text filtering and formatting.
                    if (header === 'ServiceDate') {
                        return {
                        ...baseCol,
                        filter: 'agTextColumnFilter',
                        valueFormatter: (params: ValueFormatterParams<any, any>) => (params.value ? params.value.toString() : ''),
                        valueParser: (params: any) => params.newValue
                        };
                    }

                    // For currency columns.
                    if (header === 'Amount' || header === 'Difference') {
                        baseCol.type = 'currency';
                    }

                    // Set aggregation function if applicable.
                    if (aggFunc.includes(header)) {
                        baseCol.aggFunc = 'sum';
                    }

                    return baseCol;
                    });
                
                // const dynamicColumnDefs: any = headers.map(header => ({
                //     field: header,
                //     type: header === 'Amount' || header === 'Difference' ? 'currency' : null,
                //     aggFunc: aggFunc.includes(header) ? 'sum' : null,
                //     floatingFilter: true,
                //     cellClassRules: {
                //         'new-row': (params: { data: { FactRecID: string; }; }) => 
                //             params.data.FactRecID && params.data.FactRecID.startsWith("New-"),
                //         'updated-row': (params: { data: { FactRecID: string; }; }) => 
                //             params.data.FactRecID && params.data.FactRecID.startsWith("Updated-")
                //     }
                // })); // Specify type for dynamicColumnDefs
                setColumnDefs(dynamicColumnDefs);
            }
        }
        fetchData();

    }, [inputData, enableRowGroupColumns, pivotColumns, aggFuncColumns])

    
    // Automatically mark rows as updated on any cell value change
      
    const onCellValueChanged = (event: CellValueChangedEvent) => {
        if (!event.data || !gridRef.current) return;
        const api = gridRef.current.api;
        const originalId = event.data.FactRecID;
        // Якщо це звичайний рядок і ми його ще не оновлювали, оновлюємо FactRecID лише один раз
        if (!originalId.startsWith('New-') && !originalId.startsWith('Updated-')) {
          if (!alreadyUpdatedRows.current.has(originalId)) {
            alreadyUpdatedRows.current.add(originalId);
            const newUpdatedId = getUpdatedFactRecID(originalId);
            const newData = { ...event.data, FactRecID: newUpdatedId };
            api.applyTransaction({ update: [newData] });
            setRowData(prevRowData =>
              prevRowData.map(row =>
                row.FactRecID === originalId ? newData : row
              )
            );
          }
        }
        console.log("Row updated successfully:", event.data);
      };

      
    // Transfer amount to new row function
    const transferAmountToNewRow = () => {
        const selectedRows = gridRef.current?.api.getSelectedRows() ?? [];
        if (selectedRows.length === 0) {
          alert('Select a row first.');
          return;
        }
        if (transferAmount == null || transferAmount === 0) {
          alert('Enter a valid amount.');
          return;
        }
  
        const selectedRow = selectedRows[0];
        const originalAmount = parseFloat(selectedRow.Amount);
        let newSelectedRowAmount = originalAmount - transferAmount;
  
        // Check negative constraints
        if (
          (originalAmount < 0 && transferAmount < 0 && Math.abs(newSelectedRowAmount) > Math.abs(originalAmount)) ||
          (originalAmount < 0 && transferAmount > 0 && newSelectedRowAmount > 0)
        ) {
          alert('Transfer exceeds balance.');
          return;
        }
  
        // Prepare updated row
        const updatedRow = {
          ...selectedRow,
          Amount: newSelectedRowAmount.toFixed(2),
          FactRecID: getUpdatedFactRecID(selectedRow.FactRecID), // Mark as updated
        };
  
        // Prepare new row
        const newRow = {
          ...selectedRow,
          Amount: transferAmount.toFixed(2),
          FactRecID: getNextFactRecID(selectedRow.FactRecID),
        };

        storeOriginalAmountInComments(updatedRow, originalAmount);
        storeOriginalAmountInComments(newRow, originalAmount);
  
        // Find rowNode to insert the new row right below
        const rowNode = gridRef.current?.api.getRowNode(selectedRow.FactRecID);
        if (!rowNode) return;
  
        // Update & Add
        gridRef.current?.api.applyTransaction({
          update: [updatedRow],
          add: [newRow],
          addIndex: rowNode.rowIndex !== null ? rowNode.rowIndex + 1 : undefined, // insert below
        });
        
        setRowData(prevRowData => {
            const index = prevRowData.findIndex(row => row.FactRecID === selectedRow.FactRecID);
            if (index === -1) return prevRowData;
    
            const newRowData = [...prevRowData];
            newRowData.splice(index, 1, updatedRow, newRow); // Replace the original row and insert new one below
            return newRowData;
        });

        setTransferAmount(null);

      };

    const autoGroupColumnDef = useMemo(() => {
        return {
            minWidth: 270,
            field: autoDefName,
            headerCheckboxSelection: true,
            cellRendererParams: {
                checkbox: true,
            },
        };
    }, [autoDefName]);

    const gridOptions = {
        sideBar: {
            toolPanels: [
                {
                    id: 'columns',
                    labelDefault: 'Columns',
                    labelKey: 'columns',
                    iconKey: 'columns',
                    toolPanel: 'agColumnsToolPanel',
                    toolPanelParams: {
                        suppressPivotMode: true, // Disable pivot mode toggle
                        suppresssRowGroups: true, // Disable row group toggle
                    },
                },
                {
                    id: 'filters',
                    labelDefault: 'Filters',
                    labelKey: 'filters',
                    iconKey: 'filter',
                    toolPanel: 'agFiltersToolPanel',
                },
            ],
        },
        columnDefs: columnDefs,
        suppressAggFuncInHeader: true,
        columnTypes: {
            currency: {
                flex: 1,
                minWidth: 150,
                filter: 'agNumberColumnFilter',
                floatingFilter: true,
                resizable: true,
                editable: gridLock === 'false',
                valueFormatter: currencyFormatter,
                comparator: amountComparator,
            }
        },
        defaultColDef: {
            flex: 1,
            minWidth: 150,
            filter: 'agTextColumnFilter',
            floatingFilter: true,
            resizable: true,
            editable: gridLock === 'true',
        },
        getRowId: (params:any) => params.data.FactRecID, // Important for updates        
        enableRangeSelection: true,
        statusBar: {
            statusPanels: [
                { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
                { statusPanel: 'agTotalRowCountComponent', align: 'center' },
                { statusPanel: 'agFilteredRowCountComponent' },
                { statusPanel: 'agSelectedRowCountComponent' },
                { statusPanel: 'agAggregationComponent' },
            ]
        },
        pivotMode: false,
    };
    const handleThemeChange = (selectedOption: string) => {
        setSelectedOption(selectedOption)
        setDivClass(selectedOption);
    };

    const onExcelExport = () => {
        if (gridRef.current && gridRef.current.api) {
            gridRef.current.api.exportDataAsExcel();
        }
    };
    const onSave = () => {
        const dataToSave: any[] = [];
        gridRef.current!.api.forEachNode(node => {
            if (node.data.FactRecID.startsWith('New-') || node.data.FactRecID.startsWith('Updated-')) {
                dataToSave.push(node.data);
            }
        });
        onDataChange(dataToSave);
    };

    
    return (
        <div className={divClass} style={{ height: `${height}px` }}>
            <InputContainer>
            <Theme options={option} onSelect={handleThemeChange} />
            {gridLock === 'true' && (<Button onClick={onSave} style={{ margin: '10px' }}>Save to dataverse</Button>)}
            <AltButton onClick={onExcelExport} style={{ margin: '10px' }}>Export to Excel</AltButton>                      
            {gridLock === 'true' && (<Input
                type="text"
                placeholder="Enter amount to transfer"
                // value={transferAmount !== null ? transferAmount.toString() : ""}
                onChange={(e) => {
                    const value = e.target.value; // Get the input value                    
                // Allow negative numbers, decimal points, and empty input
                if (/^-?\d*\.?\d*$/.test(value)) {
            
                    // Allow empty input or valid number formats (including negative numbers).
                    if (value === "" || value === "-" ||  value === ".") {
                        setTransferAmount(null);
                    } else {
                        // Otherwise, parse it to a float
                        setTransferAmount(parseFloat(value));
                    }
                }
                
                }}
            />)}
            {gridLock === 'true' && (<Button onClick={transferAmountToNewRow} style={{ margin: '10px' }}>Transfer Amount</Button>)}
            </InputContainer>            
            < AgGridReact
                rowData={rowData}
                columnDefs={columnDefs}
                autoGroupColumnDef={autoGroupColumnDef}
                gridOptions={gridOptions}
                rowGroupPanelShow='never'
                pagination={false}
                rowSelection={'multiple'}
                groupSelectsChildren={true}
                pivotPanelShow='never'
                tooltipShowDelay={500}
                ref={gridRef}
                onCellValueChanged={onCellValueChanged} 
            />
        </div>
    );   
});

export default AgGrid;