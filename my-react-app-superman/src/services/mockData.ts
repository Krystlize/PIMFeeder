import { Division, Category } from '../types';

export const divisions: Division[] = [
  { id: 'div22', name: 'Plumbing - div 22' },
  { id: 'div23', name: 'HVAC - div 23' },
  { id: 'div26', name: 'Electrical - div 26' },
  { id: 'div08', name: 'Architecture - div 08' },
  { id: 'div21', name: 'Fire Protection - div 21' },
  { id: 'div25', name: 'Integrated Automation - div 25' },
  { id: 'div27', name: 'Communications - div 27' },
  { id: 'div28', name: 'Electronic Safety and Security - div 28' },
];

export const categories: Category[] = [
  // Plumbing Categories
  { id: 'cat_commercial_fixtures', divisionId: 'div22', name: 'Commercial Fixtures' },
  { id: 'cat_drainage', divisionId: 'div22', name: 'Drainage' },
  { id: 'cat_piping', divisionId: 'div22', name: 'Piping' },
  { id: 'cat_valves', divisionId: 'div22', name: 'Valves' },
  
  // HVAC Categories
  { id: 'cat_heaters', divisionId: 'div23', name: 'Heaters' },
  { id: 'cat_air_handling', divisionId: 'div23', name: 'Air Handling' },
  { id: 'cat_cooling', divisionId: 'div23', name: 'Cooling Systems' },
  { id: 'cat_fans', divisionId: 'div23', name: 'Fans' },
  
  // Electrical Categories
  { id: 'cat_distribution', divisionId: 'div26', name: 'Distribution' },
  { id: 'cat_lighting', divisionId: 'div26', name: 'Lighting' },
  { id: 'cat_wiring', divisionId: 'div26', name: 'Wiring Devices' },
  
  // Architecture Categories
  { id: 'cat_doors', divisionId: 'div08', name: 'Doors and Frames' },
  { id: 'cat_windows', divisionId: 'div08', name: 'Windows' },
  { id: 'cat_hardware', divisionId: 'div08', name: 'Hardware' },
  
  // Fire Protection Categories
  { id: 'cat_sprinklers', divisionId: 'div21', name: 'Sprinklers' },
  { id: 'cat_fire_extinguishers', divisionId: 'div21', name: 'Fire Extinguishers' },
  
  // Integrated Automation Categories
  { id: 'cat_building_automation', divisionId: 'div25', name: 'Building Automation' },
  { id: 'cat_control_systems', divisionId: 'div25', name: 'Control Systems' },
  
  // Communications Categories
  { id: 'cat_data_networks', divisionId: 'div27', name: 'Data Networks' },
  { id: 'cat_voice_systems', divisionId: 'div27', name: 'Voice Systems' },
  
  // Electronic Safety and Security Categories
  { id: 'cat_access_control', divisionId: 'div28', name: 'Access Control' },
  { id: 'cat_video_surveillance', divisionId: 'div28', name: 'Video Surveillance' },
]; 