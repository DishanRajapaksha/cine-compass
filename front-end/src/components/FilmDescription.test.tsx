import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FilmDescription from './FilmDescription';
import { translateDescription } from '../services/translationService';
import { Movie } from '../types/Movie';
jest.mock('../services/translationService');
const translate = translateDescription as jest.MockedFunction<typeof translateDescription>;
const movie = {id: 'film', overview: '<p>Een dag in <b>Tokio</b>.</p>', overviewLanguage: 'nl'} as Movie;
beforeEach(() => translate.mockReset());

test('translates only on click and toggles back to the unchanged original', async () => {
  translate.mockResolvedValue('A day in Tokyo.');
  render(<FilmDescription movie={movie}/>);
  expect(translate).not.toHaveBeenCalled();
  expect(screen.getByText('Een dag in Tokio.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Translate to English'}));
  expect(screen.getByRole('button', {name: 'Translating…'})).toBeDisabled();
  expect(await screen.findByText('A day in Tokyo.')).toHaveAttribute('lang', 'en');
  expect(translate).toHaveBeenCalledWith('Een dag in Tokio.', expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('button', {name: 'Show original'}));
  expect(screen.getByText('Een dag in Tokio.')).toHaveAttribute('lang', 'nl');
  fireEvent.click(screen.getByRole('button', {name: 'Translate to English'}));
  expect(screen.getByText('A day in Tokyo.')).toBeInTheDocument();
  expect(translate).toHaveBeenCalledTimes(1);
});

test('keeps the original on failure and allows another attempt', async () => {
  translate.mockRejectedValueOnce(new Error('Translation is unavailable right now. Please try again.')).mockResolvedValueOnce('A day in Tokyo.');
  render(<FilmDescription movie={movie}/>);
  fireEvent.click(screen.getByRole('button', {name: 'Translate to English'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please try again.');
  expect(screen.getByText('Een dag in Tokio.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Translate to English'}));
  expect(await screen.findByText('A day in Tokyo.')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('cancels the request when the details close', () => {
  translate.mockImplementation(() => new Promise(() => {}));
  const view = render(<FilmDescription movie={movie}/>);
  fireEvent.click(screen.getByRole('button', {name: 'Translate to English'}));
  const signal = translate.mock.calls[0][1];
  view.unmount();
  expect(signal.aborted).toBe(true);
});

test.each([{...movie, overviewLanguage: 'en' as const}, {...movie, overview: 'No description available.'}, {...movie, overview: ' '}])('omits translation for English or missing descriptions', film => {
  render(<FilmDescription movie={film}/>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
