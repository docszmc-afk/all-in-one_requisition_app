import React, { useState, useEffect } from 'react';

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({ value, onChange, className, ...props }) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    // Only update display value if it's significantly different from the parsed value
    // This prevents cursor jumping and trailing dot removal while typing
    const parsedDisplay = parseFloat(displayValue.replace(/,/g, ''));
    if (isNaN(parsedDisplay) || parsedDisplay !== value) {
      if (value === 0 && displayValue === '') {
        // Keep empty if user cleared it
      } else {
        setDisplayValue(value ? value.toLocaleString('en-US', { maximumFractionDigits: 20 }) : '');
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    
    // Allow only numbers, commas, and a single decimal point
    val = val.replace(/[^0-9.,]/g, '');
    
    // Prevent multiple decimal points
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }

    // Format with commas on the integer part
    if (val !== '') {
      const splitVal = val.split('.');
      const intPart = splitVal[0].replace(/,/g, '');
      const formattedInt = intPart && !isNaN(parseInt(intPart, 10)) ? parseInt(intPart, 10).toLocaleString('en-US') : '';
      val = splitVal.length > 1 ? `${formattedInt}.${splitVal[1]}` : formattedInt;
    }

    setDisplayValue(val);

    const parsed = parseFloat(val.replace(/,/g, ''));
    onChange(isNaN(parsed) ? 0 : parsed);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (props.onBlur) props.onBlur(e);
    // Reformat on blur to clean up trailing dots or empty decimals
    if (value) {
      setDisplayValue(value.toLocaleString('en-US', { maximumFractionDigits: 20 }));
    } else {
      setDisplayValue('');
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      {...props}
    />
  );
};
