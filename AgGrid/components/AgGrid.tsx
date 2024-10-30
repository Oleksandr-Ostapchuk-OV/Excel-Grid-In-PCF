/*
 * MyAgGridComponent.tsx
 * Description: React component for displaying data using React Grid in TypeScript for account rec purposes
 * Author: Gabe Williams
 * Version: 1.0.0.
 * License: MIT
 */

import React, { useState, useEffect, useMemo} from 'react';
import { AgGridReact } from 'ag-grid-react';
import {ReactGrid, Column, Row, CellChange, TextCell, NumberCell} from '@silevis/reactgrid'
import '@silevis/reactgrid/styles.css' // Core CSS
import Theme from './Theme';
import {option} from './Theme';
import '../css/grid.css'

interface ReGridProps {
    inputData: string | null;
}

const ReGrid: React.FC<ReGridProps> = React.memo(({ inputData }) => {
    console.log('ReactGrid Componment')
    
    const [divClass, setDivClass] = useState('ag-theme-alpine');
    const [selectedOption, setSelectedOption] = useState<string>('');
    const [columns, setColumns] = useState<Column[]>([]);
    const [rows, setRows] = useState<Row[]>([]);
    
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

            if (data && data.length > 0) {
                const headers = Object.keys(data[0]);

                const dynamicColumns: Column[] = headers.map(header => ({
                    columnId: header,
                    width: 150,
                }));
                setColumns(dynamicColumns);

                const headerRow: Row = {
                    rowId: 'header',
                    cells: headers.map(header => ({
                        type: 'header',
                        text: header,
                    })),
                };

                const dynamicRows: Row[] = data.map((row: { [x: string]: any; }, rowIndex: { toString: () => any; }) => ({
                    rowId: rowIndex.toString(),
                    cells: headers.map(header => {
                        const value = row[header];
                        return typeof value === "number"
                            ? { type: "number", value } as NumberCell
                            : { type: "text", text: value?.toString() || "" } as TextCell;
                    }),
                }));
                const allRows: Row[] = [headerRow, ...dynamicRows];
                setRows(allRows);
            }
        };
        fetchData();

    }, [inputData])
    
    const handleThemeChange = (selectedOption: string) => {
        setSelectedOption(selectedOption)
        setDivClass(selectedOption);
    };

    
    const onCellsChanged = (changes: CellChange[]) => {
        // Update the rows based on the cell changes
        setRows((prevRows) => {
            return prevRows.map(row => {
                // Check if the rowId in the changes matches the current rowId
                const change = changes.find(c => c.rowId === row.rowId);
                console.log('change:', change?.rowId, 'rowID:', row.rowId)
                console.log('prevRows:', prevRows)
                
                if (change) {
                    // Update the specific cell that was changed
                    return {
                        ...row,
                        cells: row.cells.map((cell, index) => {
                            // Check if the cell columnId matches
                            const header = columns[index].columnId;
                            console.log(header)
                            if (header === change.columnId) {
                                // Depending on the cell type, update accordingly
                                if (cell.type === 'number') {
                                    return {
                                        type: 'number',
                                        value: (change.newCell as NumberCell).value // Update with new value
                                    } as NumberCell;
                                } else {
                                    return {
                                        type: 'text',
                                        text: (change.newCell as TextCell).text // Update with new text
                                    } as TextCell;
                                }
                            }
                            return cell; // Return unchanged cell
                        }),
                    };
                }
                return row; // Return unchanged row if no change for this row
            });
        });
    }; 

    return (
        <div className={divClass} style={{ width: '100%', height: '80vh' }}>
            <Theme options={option} onSelect={handleThemeChange} />
            < ReactGrid
                rows={rows}
                columns={columns}
                onCellsChanged={onCellsChanged}
                enableRangeSelection={true}
            />
        </div>
    );
});

export default ReGrid;