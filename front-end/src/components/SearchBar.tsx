import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const SearchContainer = styled.div`
  position: relative;
  max-width: 400px;
  margin: 0 auto;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 20px 12px 45px;
  font-size: 16px;
  border: 2px solid #e1e5e9;
  border-radius: 25px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  
  &:focus {
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }
  
  &::placeholder {
    color: #999;
  }
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
  font-size: 18px;
  pointer-events: none;
`;

const ClearButton = styled.button<{ isVisible: boolean }>`
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #999;
  font-size: 18px;
  cursor: pointer;
  opacity: ${props => props.isVisible ? 1 : 0};
  transition: opacity 0.2s ease;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: #666;
  }
`;

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
  };

  // Memoize the onSearch callback to prevent infinite re-renders
  const memoizedOnSearch = useCallback(onSearch, [onSearch]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      memoizedOnSearch(query);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [query, memoizedOnSearch]);

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch(query);
    }
  };

  return (
    <SearchContainer>
      <SearchIcon>🔍</SearchIcon>
      <SearchInput
        type="text"
        placeholder="Search movies..."
        value={query}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
      />
      <ClearButton
        isVisible={query.length > 0}
        onClick={handleClear}
        aria-label="Clear search"
      >
        ✕
      </ClearButton>
    </SearchContainer>
  );
};

export default SearchBar; 