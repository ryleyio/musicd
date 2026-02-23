import React, { useState, useCallback, useRef, useEffect } from 'react';

interface SearchProps {
  onSearch: (query: string) => void;
  autoFocus?: boolean;
}

export default function Search({ onSearch, autoFocus }: SearchProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onSearch(newValue);
  }, [onSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setValue('');
      onSearch('');
    }
  }, [onSearch]);

  return (
    <>
      <style>{`
        .search-container {
          position: relative;
          width: 100%;
        }
        .search-input {
          width: 100%;
          padding: 10px 15px;
          border-radius: 20px;
          border: none;
          background: #333;
          color: #fff;
          font-size: 14px;
          outline: none;
          transition: background 0.2s, box-shadow 0.2s;
        }
        .search-input:focus {
          background: #404040;
          box-shadow: 0 0 0 2px rgba(29, 185, 84, 0.3);
        }
        .search-input::placeholder {
          color: #999;
        }
        @media (max-width: 768px) {
          .search-input {
            padding: 12px 16px;
            font-size: 16px; /* Prevents iOS zoom */
          }
        }
      `}</style>
      <div className="search-container">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search..."
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="search-input"
        />
      </div>
    </>
  );
}
