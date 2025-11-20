import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { City, MovieFilters } from '../types/Movie';

interface MovieFiltersProps {
  cities: City[];
  filters: MovieFilters;
  onFiltersChange: (filters: MovieFilters) => void;
  loading?: boolean;
  availableSpecials?: {
    specials: string[];
  };
  specialsLoading?: boolean;
  availableSpokenLanguages?: string[];
}

const FiltersContainer = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const FiltersTitle = styled.h3`
  font-size: 1.2rem;
  font-weight: 600;
  color: #333;
  margin: 0 0 15px 0;
`;

const FilterSection = styled.div`
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const FilterLabel = styled.label`
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: #555;
  margin-bottom: 8px;
`;

const Select = styled.select`
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 0.9rem;
  background: white;
  color: #333;
  cursor: pointer;
  transition: border-color 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #007bff;
  }
  
  &:disabled {
    background: #f8f9fa;
    cursor: not-allowed;
  }
`;

const TheatersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
  margin-top: 10px;
`;

const TheaterCheckbox = styled.label<{ checked: boolean }>`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: ${props => props.checked ? '#007bff' : '#f8f9fa'};
  border: 2px solid ${props => props.checked ? '#007bff' : '#e1e5e9'};
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
  color: ${props => props.checked ? 'white' : '#333'};
  
  &:hover {
    background: ${props => props.checked ? '#0056b3' : '#e9ecef'};
    border-color: #007bff;
  }
`;

const CheckboxInput = styled.input`
  margin-right: 8px;
  cursor: pointer;
`;

const ClearButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s ease;
  margin-top: 10px;
  
  &:hover {
    background: #5a6268;
  }
  
  &:disabled {
    background: #adb5bd;
    cursor: not-allowed;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  padding: 6px 8px;
  border-radius: 8px;
  transition: background 0.2s ease;

  &:hover {
    background: #f3f4f6;
  }
`;

const CollapseIndicator = styled.span<{ $collapsed: boolean }>`
  font-size: 0.85rem;
  color: #4b5563;
  transform: rotate(${props => (props.$collapsed ? '-90deg' : '0deg')});
  transition: transform 0.2s ease;
`;

const SelectedSummary = styled.div`
  margin-top: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #1f2937;
`;

const SelectedPills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
`;

const SelectedPill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 9999px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid #c7d2fe;
`;

const LoadingText = styled.div`
  color: #6c757d;
  font-style: italic;
  padding: 10px 0;
`;

const TimeInputsContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-top: 10px;
  
  @media (min-width: 600px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
`;

const TimeInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const TimeLabel = styled.label`
  font-size: 0.85rem;
  font-weight: 500;
  color: #555;
`;

const TimeInput = styled.input`
  padding: 8px 10px;
  border: 2px solid #e1e5e9;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
  color: #333;
  cursor: pointer;
  transition: border-color 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #007bff;
  }
  
  &::-webkit-calendar-picker-indicator {
    cursor: pointer;
  }
`;

const MovieFiltersComponent: React.FC<MovieFiltersProps> = ({
  cities,
  filters,
  onFiltersChange,
  loading = false,
  availableSpecials,
  specialsLoading = false,
  availableSpokenLanguages = []
}) => {
  const [selectedCity, setSelectedCity] = useState<string>(filters.selectedCity || '');
  const [selectedTheaters, setSelectedTheaters] = useState<string[]>(filters.selectedTheaters);
  const [theatersCollapsed, setTheatersCollapsed] = useState<boolean>(false);

  const [selectedSubtitleLanguages, setSelectedSubtitleLanguages] = useState<string[]>(filters.selectedSubtitleLanguages);
  const [selectedSpokenLanguages, setSelectedSpokenLanguages] = useState<string[]>(filters.selectedSpokenLanguages);
  const [selectedSpecials, setSelectedSpecials] = useState<string[]>(filters.selectedSpecials);
  const [startTime, setStartTime] = useState<string>(filters.startTime || '');
  const [endTime, setEndTime] = useState<string>(filters.endTime || '');
  // Helper function to get default dates - current day for both start and end
  const getDefaultDates = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    return {
      startDate: today,
      endDate: today
    };
  };

  const defaultDates = getDefaultDates();
  const [startDate, setStartDate] = useState<string>(filters.startDate || defaultDates.startDate);
  const [endDate, setEndDate] = useState<string>(filters.endDate || defaultDates.endDate);
  const [spokenLanguagesCollapsed, setSpokenLanguagesCollapsed] = useState<boolean>(false);
  const [specialsCollapsed, setSpecialsCollapsed] = useState<boolean>(false);

  // Update local state when filters prop changes (for default values)
  useEffect(() => {
    setSelectedCity(filters.selectedCity || '');
    setSelectedTheaters(filters.selectedTheaters);

    setSelectedSubtitleLanguages(filters.selectedSubtitleLanguages);
    setSelectedSpokenLanguages(filters.selectedSpokenLanguages);
    setSelectedSpecials(filters.selectedSpecials);
    setStartTime(filters.startTime || '');
    setEndTime(filters.endTime || '');
    setStartDate(filters.startDate || '');
    setEndDate(filters.endDate || '');
  }, [filters.selectedCity, filters.selectedTheaters, filters.selectedSubtitleLanguages, filters.selectedSpokenLanguages, filters.selectedSpecials, filters.startTime, filters.endTime, filters.startDate, filters.endDate]);

  const selectedCityData = cities.find(city => city.name === selectedCity);
  const selectedTheaterNames = selectedCityData
    ? selectedCityData.theaters
      .filter(theater => selectedTheaters.includes(theater.id))
      .map(theater => theater.name)
    : [];

  useEffect(() => {
    onFiltersChange({
      selectedCity: selectedCity || null,
      selectedTheaters,
      selectedSubtitleLanguages,
      selectedSpokenLanguages,
      selectedSpecials,
      startTime: startTime || null,
      endTime: endTime || null,
      startDate: startDate || null,
      endDate: endDate || null
    });
  }, [selectedCity, selectedTheaters, selectedSubtitleLanguages, selectedSpokenLanguages, selectedSpecials, startTime, endTime, startDate, endDate, onFiltersChange]);

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCity = e.target.value;
    setSelectedCity(newCity);
    // Clear theater selection when city changes
    setSelectedTheaters([]);
  };

  const handleTheaterChange = (theaterId: string, checked: boolean) => {
    if (checked) {
      setSelectedTheaters(prev => [...prev, theaterId]);
    } else {
      setSelectedTheaters(prev => prev.filter(id => id !== theaterId));
    }
  };



  const handleSubtitleLanguageChange = (language: string, checked: boolean) => {
    if (checked) {
      setSelectedSubtitleLanguages(prev => [...prev, language]);
    } else {
      setSelectedSubtitleLanguages(prev => prev.filter(lang => lang !== language));
    }
  };

  const handleSpokenLanguageChange = (language: string, checked: boolean) => {
    if (checked) {
      setSelectedSpokenLanguages(prev => [...prev, language]);
    } else {
      setSelectedSpokenLanguages(prev => prev.filter(lang => lang !== language));
    }
  };

  const handleSpecialsChange = (special: string, checked: boolean) => {
    if (checked) {
      setSelectedSpecials(prev => [...prev, special]);
    } else {
      setSelectedSpecials(prev => prev.filter(s => s !== special));
    }
  };

  const handleTimeChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartTime(value);
    } else {
      setEndTime(value);
    }
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
  };

  const handleClearFilters = () => {
    setSelectedCity('');
    setSelectedTheaters([]);
    setSelectedSubtitleLanguages([]);
    setSelectedSpokenLanguages([]);
    setSelectedSpecials([]);
    setStartTime('');
    setEndTime('');
    setStartDate('');
    setEndDate('');
    setSpokenLanguagesCollapsed(false);
    setSpecialsCollapsed(false);
  };

  const hasActiveFilters = selectedCity || selectedTheaters.length > 0 ||
    selectedSubtitleLanguages.length > 0 || selectedSpokenLanguages.length > 0 || selectedSpecials.length > 0 ||
    startTime || endTime || startDate || endDate;

  if (loading) {
    return (
      <FiltersContainer>
        <FiltersTitle>Filters</FiltersTitle>
        <LoadingText>Loading theaters...</LoadingText>
      </FiltersContainer>
    );
  }

  return (
    <FiltersContainer>
      {/* City Filter */}
      <FilterSection>
        <Select
          id="city-select"
          value={selectedCity}
          onChange={handleCityChange}
        >
          <option value="">All cities</option>
          {cities.map(city => (
            <option key={city.name} value={city.name}>
              {city.name} ({city.theaters.length} cinemas)
            </option>
          ))}
        </Select>
      </FilterSection>

      <FilterSection>
        <TheaterCheckbox
          checked={selectedSubtitleLanguages.includes('en')}
          onClick={() => handleSubtitleLanguageChange('en', !selectedSubtitleLanguages.includes('en'))}
        >
          <CheckboxInput
            type="checkbox"
            checked={selectedSubtitleLanguages.includes('en')}
            onChange={(e) => handleSubtitleLanguageChange('en', e.target.checked)}
          />
          English Subtitles
        </TheaterCheckbox>
      </FilterSection>

      <FilterSection>
        <TimeInputsContainer>
          <TimeInputGroup>
            <TimeLabel htmlFor="start-date">From date:</TimeLabel>
            <TimeInput
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDateChange('start', e.target.value)}
            />
          </TimeInputGroup>
          <TimeInputGroup>
            <TimeLabel htmlFor="end-date">To date:</TimeLabel>
            <TimeInput
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDateChange('end', e.target.value)}
            />
          </TimeInputGroup>
        </TimeInputsContainer>
      </FilterSection>

      <FilterSection>
        <TimeInputsContainer>
          <TimeInputGroup>
            <TimeLabel htmlFor="start-time">Starts from:</TimeLabel>
            <TimeInput
              id="start-time"
              type="time"
              value={startTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTimeChange('start', e.target.value)}
            />
          </TimeInputGroup>
          <TimeInputGroup>
            <TimeLabel htmlFor="end-time">Ends by:</TimeLabel>
            <TimeInput
              id="end-time"
              type="time"
              value={endTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTimeChange('end', e.target.value)}
            />
          </TimeInputGroup>
        </TimeInputsContainer>
      </FilterSection>

      {selectedCityData && (
        <FilterSection>
          <SectionHeader
            role="button"
            tabIndex={0}
            onClick={() => setTheatersCollapsed(prev => !prev)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setTheatersCollapsed(prev => !prev);
              }
            }}
            aria-expanded={!theatersCollapsed}
            aria-label={`Toggle cinemas in ${selectedCity}`}
          >
            <FilterLabel as="div" style={{ marginBottom: 0, flex: 1 }}>Cinemas in {selectedCity}</FilterLabel>
            <CollapseIndicator $collapsed={theatersCollapsed}>▾</CollapseIndicator>
          </SectionHeader>

          {!theatersCollapsed && (
            <TheatersGrid>
              {selectedCityData.theaters.map(theater => {
                const isChecked = selectedTheaters.includes(theater.id);
                return (
                  <TheaterCheckbox key={theater.id} checked={isChecked}>
                    <CheckboxInput
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleTheaterChange(theater.id, e.target.checked)}
                    />
                    {theater.name}
                  </TheaterCheckbox>
                );
              })}
            </TheatersGrid>
          )}

          {theatersCollapsed && selectedTheaterNames.length > 0 && (
            <SelectedSummary>
              <SelectedPills>
                {selectedTheaterNames.map(name => (
                  <SelectedPill key={name}>{name}</SelectedPill>
                ))}
              </SelectedPills>
            </SelectedSummary>
          )}
        </FilterSection>
      )}

      <FilterSection>
        <SectionHeader
          role="button"
          tabIndex={0}
          onClick={() => setSpokenLanguagesCollapsed(prev => !prev)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSpokenLanguagesCollapsed(prev => !prev);
            }
          }}
          aria-expanded={!spokenLanguagesCollapsed}
          aria-label="Toggle spoken languages"
        >
          <FilterLabel as="div" style={{ marginBottom: 0, flex: 1 }}>Spoken Languages</FilterLabel>
          <CollapseIndicator $collapsed={spokenLanguagesCollapsed}>▾</CollapseIndicator>
        </SectionHeader>

        {!spokenLanguagesCollapsed && (
          <TheatersGrid>
            {(availableSpokenLanguages && availableSpokenLanguages.length > 0) ? (
              availableSpokenLanguages.map(language => {
                const isChecked = selectedSpokenLanguages.includes(language);
                return (
                  <TheaterCheckbox key={language} checked={isChecked}>
                    <CheckboxInput
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleSpokenLanguageChange(language, e.target.checked)}
                    />
                    {language}
                  </TheaterCheckbox>
                );
              })
            ) : (
              <LoadingText>No language data yet</LoadingText>
            )}
          </TheatersGrid>
        )}

        {spokenLanguagesCollapsed && selectedSpokenLanguages.length > 0 && (
          <SelectedSummary>
            <SelectedPills>
              {selectedSpokenLanguages.map(language => (
                <SelectedPill key={language}>{language}</SelectedPill>
              ))}
            </SelectedPills>
          </SelectedSummary>
        )}
      </FilterSection>

      <FilterSection>
        <SectionHeader
          role="button"
          tabIndex={0}
          onClick={() => setSpecialsCollapsed(prev => !prev)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSpecialsCollapsed(prev => !prev);
            }
          }}
          aria-expanded={!specialsCollapsed}
          aria-label="Toggle specials"
        >
          <FilterLabel as="div" style={{ marginBottom: 0, flex: 1 }}>Specials</FilterLabel>
          <CollapseIndicator $collapsed={specialsCollapsed}>▾</CollapseIndicator>
        </SectionHeader>

        {!specialsCollapsed && (
          <TheatersGrid>
            {specialsLoading ? (
              <LoadingText>Loading specials...</LoadingText>
            ) : availableSpecials?.specials?.length ? (
              availableSpecials.specials.map(special => {
                const isChecked = selectedSpecials.includes(special);
                return (
                  <TheaterCheckbox key={special} checked={isChecked}>
                    <CheckboxInput
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleSpecialsChange(special, e.target.checked)}
                    />
                    {special}
                  </TheaterCheckbox>
                );
              })
            ) : (
              <LoadingText>No specials available</LoadingText>
            )}
          </TheatersGrid>
        )}

        {specialsCollapsed && selectedSpecials.length > 0 && (
          <SelectedSummary>
            <SelectedPills>
              {selectedSpecials.map(special => (
                <SelectedPill key={special}>{special}</SelectedPill>
              ))}
            </SelectedPills>
          </SelectedSummary>
        )}
      </FilterSection>

      {hasActiveFilters && (
        <ClearButton onClick={handleClearFilters}>
          Clear Filters
        </ClearButton>
      )}

    </FiltersContainer>
  );
};

export default MovieFiltersComponent; 
