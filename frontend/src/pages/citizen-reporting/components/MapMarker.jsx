import React from 'react';
import Icon from '../../../components/AppIcon';

const MapMarker = ({ issueType }) => {
  const getIssueTypeInfo = (typeId) => {
    const types = {
      air_pollution: { name: 'Air Pollution', icon: 'Wind', color: '#DC2626' },
      water_pollution: { name: 'Water Pollution', icon: 'Droplets', color: '#4A90A4' },
      noise_pollution: { name: 'Noise Pollution', icon: 'Volume2', color: '#D97706' },
      litter_waste: { name: 'Litter & Waste', icon: 'Trash2', color: '#6B7280' },
      green_space_damage: { name: 'Green Space Damage', icon: 'Trees', color: '#2D5A27' },
      wildlife_concern: { name: 'Wildlife Concern', icon: 'Bird', color: '#059669' },
      infrastructure: { name: 'Infrastructure Issues', icon: 'Construction', color: '#7C3AED' },
      other: { name: 'Other Environmental Issue', icon: 'AlertTriangle', color: '#F4A261' }
    };
    return types?.[typeId] || types?.other;
  };

  const type = getIssueTypeInfo(issueType);

  return (
    <div 
      className="w-8 h-8 rounded-full shadow-lg flex items-center justify-center border-2 border-white"
      style={{ backgroundColor: type.color }}
    >
      <Icon name={type.icon} size={16} className="text-white" />
    </div>
  );
};

export default MapMarker;