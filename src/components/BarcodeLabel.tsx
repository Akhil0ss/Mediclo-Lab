'use client';

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeLabelProps {
    value: string;
    width?: number;
    height?: number;
    fontSize?: number;
    displayValue?: boolean;
    format?: string;
}

const BarcodeLabel: React.FC<BarcodeLabelProps> = ({
    value,
    width = 2,
    height = 50,
    fontSize = 14,
    displayValue = true,
    format = "CODE128"
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current) {
            try {
                JsBarcode(canvasRef.current, value, {
                    format: format,
                    width: width,
                    height: height,
                    displayValue: displayValue,
                    fontSize: fontSize,
                    textMargin: 2,
                    margin: 5
                });
            } catch (error) {
                console.error("Failed to generate barcode:", error);
            }
        }
    }, [value, width, height, fontSize, displayValue, format]);

    return (
        <canvas ref={canvasRef} className="max-w-full h-auto"></canvas>
    );
};

export default BarcodeLabel;
