import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Select from '../../../components/ui/Select';

const IssueDescription = ({ description, onDescriptionChange, severity, onSeverityChange }) => {
  const [wordCount, setWordCount] = useState(description?.length || 0);

  const severityOptions = [
    { value: 'low', label: 'Low Security', description: 'Minor issue, routine handling', securityLevel: 'Low priority - Standard response time' },
    { value: 'moderate', label: 'Moderate Security', description: 'Noticeable issue, prioritized handling', securityLevel: 'Medium priority - Expedited response' },
    { value: 'high', label: 'High Security', description: 'Significant risk, immediate attention required', securityLevel: 'High priority - Urgent response needed' },
    { value: 'critical', label: 'Critical Security', description: 'Severe threat, emergency response required', securityLevel: 'Highest priority - Immediate emergency response' }
  ];

  const suggestedKeywords = [
    'visible smoke', 'strong odor', 'discolored water', 'excessive noise',
    'damaged vegetation', 'wildlife affected', 'public health concern',
    'recurring issue', 'industrial source', 'traffic related'
  ];

  const handleDescriptionChange = (e) => {
    const text = e?.target?.value;
    setWordCount(text?.length);
    onDescriptionChange(text);
  };

  const addKeyword = (keyword) => {
    const currentText = description || '';
    const newText = currentText ? `${currentText} ${keyword}` : keyword;
    onDescriptionChange(newText);
    setWordCount(newText?.length);
  };

  const getSeverityColor = (severityValue) => {
    switch (severityValue) {
      case 'low': return '#059669';
      case 'moderate': return '#D97706';
      case 'high': return '#DC2626';
      case 'critical': return '#7C2D12';
      default: return '#6B7280';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Issue Description</h3>
        <p className="text-sm text-muted-foreground">Provide detailed information about the environmental issue</p>
      </div>
      {/* Severity Assessment */}
      <div className="space-y-3">
        <Select
          label="Severity Level"
          description="How severe is this environmental issue?"
          options={severityOptions}
          value={severity}
          onChange={onSeverityChange}
          placeholder="Select severity level"
          required
        />
        
        {severity && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getSeverityColor(severity) }}
              />
              <span className="text-muted-foreground">
                {severityOptions?.find(opt => opt?.value === severity)?.description}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <Icon name="Shield" size={14} className="text-primary" />
              <span className="text-primary font-medium">
                {severityOptions?.find(opt => opt?.value === severity)?.securityLevel}
              </span>
            </div>
          </div>
        )}
      </div>
      {/* Description Text Area */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">Detailed Description</label>
          <span className="text-xs text-muted-foreground">{wordCount}/1000 characters</span>
        </div>
        
        <textarea
          value={description || ''}
          onChange={handleDescriptionChange}
          placeholder={`Describe the environmental issue in detail...\n\nInclude:\n• What you observed\n• When it started/how long it's been happening\n• Any potential causes\n• Impact on the area or community\n• Any immediate health or safety concerns`}
          className="w-full h-32 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          maxLength={1000}
          required
        />
        
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <Icon name="AlertCircle" size={12} />
          <span>Be specific and objective in your description. Avoid personal opinions.</span>
        </div>
      </div>
      {/* Suggested Keywords */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Icon name="Tag" size={16} className="text-primary" />
          <label className="text-sm font-medium text-foreground">Suggested Keywords</label>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {suggestedKeywords?.map((keyword) => (
            <button
              key={keyword}
              onClick={() => addKeyword(keyword)}
              className="inline-flex items-center px-3 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-full transition-colors duration-200"
            >
              <Icon name="Plus" size={12} className="mr-1" />
              {keyword}
            </button>
          ))}
        </div>
        
        <p className="text-xs text-muted-foreground">
          Click keywords to add them to your description
        </p>
      </div>
      {/* Additional Information */}
      <div className="bg-muted/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center space-x-2">
          <Icon name="Lightbulb" size={16} className="text-primary" />
          <h4 className="font-medium text-foreground text-sm">Tips for Better Reports</h4>
        </div>
        
        <ul className="text-xs text-muted-foreground space-y-1 pl-6">
          <li>• Include specific times, dates, and durations when possible</li>
          <li>• Mention any patterns you've noticed (daily, weekly, seasonal)</li>
          <li>• Describe the scale and extent of the issue</li>
          <li>• Note any immediate risks to public health or safety</li>
          <li>• Mention if you've reported this issue before or to other authorities</li>
        </ul>
      </div>
    </div>
  );
};

export default IssueDescription;