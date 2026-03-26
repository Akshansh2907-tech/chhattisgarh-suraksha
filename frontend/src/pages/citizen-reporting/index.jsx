import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Header from '../../components/ui/Header';
import AlertNotificationBar from '../../components/ui/AlertNotificationBar';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { reportService } from '../../utils/report';
import api from '../../utils/api';
import { storeMedia, incrementReportCount, checkAndAwardAchievements, ACHIEVEMENTS } from '../../utils/mediaStorage';

// Import components
import IssueTypeSelector from './components/IssueTypeSelector';
import LocationCapture from './components/LocationCapture';
import PhotoUpload from './components/PhotoUpload';
import IssueDescription from './components/IssueDiscription';
import AdditionalData from './components/AdditionalData';
import ReportPreview from './components/ReportPreview';
import NearbyReports from './components/NearByReports';

const CitizenReporting = () => {
  const navigate = useNavigate();
  const { user, loading, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Check authentication
  useEffect(() => {
    if (!loading && !user) {
      toast.error('Please login to submit reports');
      navigate('/login', { state: { from: '/citizen-reporting' } });
    }
  }, [user, loading, navigate]);
  
  // Form data state
  const [reportData, setReportData] = useState({
    issueType: '',
    location: null,
    photos: [],
    description: '',
    severity: '',
    additionalData: {}
  });

  const steps = [
    { id: 1, name: 'Issue Type', icon: 'Tag' },
    { id: 2, name: 'Location', icon: 'MapPin' },
    { id: 3, name: 'Photos', icon: 'Camera' },
    { id: 4, name: 'Description', icon: 'FileText' },
    { id: 5, name: 'Additional Info', icon: 'Info' }
  ];

  const updateReportData = (field, value) => {
    setReportData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return reportData?.issueType !== '';
      case 2:
        return reportData?.location !== null;
      case 3:
        return true; // Photos are optional
      case 4:
        return reportData?.description?.trim() !== '' && reportData?.severity !== '';
      case 5:
        return true; // Additional data is optional
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep < steps?.length) {
        setCurrentStep(currentStep + 1);
      } else {
        setShowPreview(true);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Store media files first with retry logic
      const reportIdClient = `report_${Date.now()}`;
      let mediaIds = [];
      
      if (reportData.photos.length > 0) {
        // Show immediate feedback that photos are being verified/uploaded
        toast.info('Verifying and uploading photos. This may take a few seconds...');
        // First try storing all photos
        try {
          mediaIds = await storeMedia(reportData.photos, reportIdClient);
        } catch (mediaErr) {
          console.warn('Initial media storage failed, trying with reduced quality:', mediaErr);
          
          // If that fails, try storing with reduced quality
          try {
            const compressedPhotos = reportData.photos.map(photo => ({
              ...photo,
              quality: 0.5,  // Reduce quality to 50%
              maxWidth: 1024 // Limit max width
            }));
            mediaIds = await storeMedia(compressedPhotos, reportIdClient);
          } catch (compressErr) {
            console.error('Failed to store even compressed media:', compressErr);
            
            // If that also fails, try storing just one photo
            if (reportData.photos.length > 1) {
              try {
                const singlePhoto = [reportData.photos[0]].map(photo => ({
                  ...photo,
                  quality: 0.5,
                  maxWidth: 800
                }));
                mediaIds = await storeMedia(singlePhoto, reportIdClient);
                toast.warning('Only the first photo could be saved due to storage limitations.');
              } catch (singleErr) {
                console.error('Failed to store even a single photo:', singleErr);
                mediaIds = [];
                toast.warning('Could not save photos due to storage limitations. Continuing without photos.');
              }
            } else {
              mediaIds = [];
              toast.warning('Could not save photo due to storage limitations. Continuing without photo.');
            }
          }
        }

        // After attempting to store media, give user feedback about uploaded vs local-fallback images
        if (mediaIds && mediaIds.length > 0) {
          const localFallbacks = mediaIds.filter(id => String(id).startsWith('local_'));
          if (localFallbacks.length === 0) {
            toast.success('Photos uploaded and verified successfully.');
          } else {
            toast.warning(`${localFallbacks.length} photo(s) could not be uploaded and were saved locally. They will be uploaded automatically when connectivity improves.`);
          }
        }
      }
      
      // Format location as a string for blockchain, but also keep the structured object
      const locationString = reportData.location 
        ? `${reportData.location.latitude},${reportData.location.longitude}|${reportData.location.address}`
        : '';
      const locationObject = reportData.location || null;

      // Format keywords from additional data
      const keywords = [
        reportData.additionalData?.keywords || '',
        reportData.additionalData?.tags || [],
        reportData.severity // Include severity as a keyword for search
      ].flat().filter(Boolean).join(',');

      // Prepare report data for blockchain
      const formattedReport = {
        issueType: reportData.issueType,
        description: reportData.description,
        severity: reportData.severity,
        keywords: keywords,
        // include both structured location (so backend can save lat/lon) and a string for the chain
        location: locationObject,
        locationString: locationString,
        photoHash: JSON.stringify(mediaIds), // Store media IDs
        additionalData: JSON.stringify({
          ...reportData.additionalData,
          reportId: reportIdClient,
          mediaIds,
          accuracy: reportData.location?.accuracy,
          source: reportData.location?.source,
          timestamp: new Date().toISOString()
        })
      };

      // Debug: log before submitting so we can see in browser console whether the POST is attempted
      console.log('[CitizenReporting] submitting report payload preview:', {
        issueType: formattedReport.issueType,
        severity: formattedReport.severity,
        locationPresent: !!formattedReport.location,
        locationStringPreview: String(formattedReport.locationString).slice(0,80),
        photosCount: mediaIds.length
      });

      // Submit to backend which will insert into DB and forward to blockchain
      const response = await reportService.submitReport(formattedReport);
      
      // Increment report count and check for achievements
      const newCount = incrementReportCount();
      const newAchievements = checkAndAwardAchievements(newCount);
      
  console.log('Report submitted with transaction:', response.txHash, 'reportId:', response.reportId);
      
      // Show achievement notification if any new ones were earned
      if (newAchievements.length > 0) {
        const achievementNames = newAchievements
          .map(id => ACHIEVEMENTS[id].name)
          .join(', ');
        toast.success(`🏆 Achievement Unlocked: ${achievementNames}!`, {
          duration: 5000
        });
      }
      
      // Show success message with report ID and points earned
      toast.success('Report submitted successfully!', {
        description: `Your report has been recorded with ID: ${response.reportId || 'N/A'}${response.pointsAwarded ? ` (+${response.pointsAwarded} impact points)` : ''}`,
        duration: 5000
      });

      // Refresh profile/stats from server (if authenticated)
      try {
        if (user?.id && refreshProfile) {
          await refreshProfile();
          // Notify other parts of the app that data has changed (community stats, map markers, etc.)
          try {
            window.dispatchEvent(new CustomEvent('cs:data-updated'));
          } catch (e) {
            console.warn('Failed to dispatch cs:data-updated event', e);
          }
          // Optionally show a small toast indicating updated impact
          try {
            const statsResp = await api.get(`/users/${user.id}/stats`);
            const stats = statsResp?.data?.data;
            if (stats) {
              const msg = `Reports: ${stats.reportsSubmitted} • Impact: ${stats.impactScore}`;
              toast.info('Impact Updated!', {
                description: msg,
                duration: 4000
              });
            }
          } catch (err) {
            // Non-fatal: just log
            console.warn('Could not fetch updated user stats:', err);
          }
        }
      } catch (err) {
        console.warn('Could not refresh profile after submission:', err);
      }
      
      // Reset form
      setReportData({
        issueType: '',
        location: null,
        photos: [],
        description: '',
        severity: '',
        additionalData: {}
      });
      setCurrentStep(1);
      setShowPreview(false);
    } catch (error) {
      console.error('Failed to submit report:', error);
      
      // Check for specific error types
      if (error.response?.status === 401) {
        toast.error('Your session has expired. Please login again.');
        navigate('/login', { state: { from: '/citizen-reporting' } });
      } else if (error.response?.status === 400) {
        toast.error(error.response?.data?.error || 'Invalid report data. Please check your entries.');
      } else if (error.message === 'Blockchain not initialized') {
        toast.error('The reporting system is temporarily unavailable. Please try again in a few minutes.');
      } else {
        // Surface server-sent message when available to help debugging
        const serverMsg = error.response?.data?.error || error.response?.data?.message || error.message;
        console.error('Report submission error detail:', serverMsg, error);
        toast.error(`Failed to submit report: ${serverMsg}`);
      }

      // Keep the form data so user doesn't lose their input
      setShowPreview(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    if (showPreview) {
      return (
        <ReportPreview
          reportData={reportData}
          onEdit={() => setShowPreview(false)}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      );
    }

    switch (currentStep) {
      case 1:
        return (
          <IssueTypeSelector
            selectedType={reportData?.issueType}
            onTypeSelect={(type) => updateReportData('issueType', type)}
          />
        );
      case 2:
        return (
          <LocationCapture
            location={reportData?.location}
            onLocationChange={(location) => updateReportData('location', location)}
          />
        );
      case 3:
        return (
          <PhotoUpload
            photos={reportData?.photos}
            onPhotosChange={(photos) => updateReportData('photos', photos)}
          />
        );
      case 4:
        return (
          <IssueDescription
            description={reportData?.description}
            onDescriptionChange={(description) => updateReportData('description', description)}
            severity={reportData?.severity}
            onSeverityChange={(severity) => updateReportData('severity', severity)}
          />
        );
      case 5:
        return (
          <AdditionalData
            additionalData={reportData?.additionalData}
            onAdditionalDataChange={(data) => updateReportData('additionalData', data)}
          />
        );
      default:
        return null;
    }
  };

  const getStepProgress = () => {
    return ((currentStep - 1) / steps?.length) * 100;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AlertNotificationBar />
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
              <Link to="/environmental-dashboard" className="hover:text-foreground transition-colors duration-200">
                Dashboard
              </Link>
              <Icon name="ChevronRight" size={14} />
              <span>Citizen Reporting</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Report Environmental Issue</h1>
            <p className="text-muted-foreground">
              Help improve your community by reporting environmental concerns. Your reports help authorities take action and keep everyone informed.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                {/* Progress Header */}
                {!showPreview && (
                  <div className="bg-muted/30 px-6 py-4 border-b border-border">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-foreground">
                        Step {currentStep} of {steps?.length}: {steps?.[currentStep - 1]?.name}
                      </h2>
                      <span className="text-sm text-muted-foreground">
                        {Math.round(getStepProgress())}% Complete
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${getStepProgress()}%` }}
                      />
                    </div>
                    
                    {/* Step Indicators */}
                    <div className="flex items-center justify-between mt-4">
                      {steps?.map((step) => (
                        <div
                          key={step?.id}
                          className={`flex items-center space-x-2 ${
                            step?.id <= currentStep ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                            step?.id < currentStep 
                              ? 'bg-primary text-primary-foreground' 
                              : step?.id === currentStep
                              ? 'bg-primary/20 text-primary border-2 border-primary' :'bg-muted text-muted-foreground'
                          }`}>
                            {step?.id < currentStep ? (
                              <Icon name="Check" size={14} />
                            ) : (
                              <Icon name={step?.icon} size={14} />
                            )}
                          </div>
                          <span className="hidden sm:block text-sm font-medium">{step?.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step Content */}
                <div className="p-6">
                  {renderStepContent()}
                </div>

                {/* Navigation Footer */}
                {!showPreview && (
                  <div className="bg-muted/30 px-6 py-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        onClick={handlePrevious}
                        disabled={currentStep === 1}
                        iconName="ChevronLeft"
                        iconPosition="left"
                      >
                        Previous
                      </Button>
                      
                      <div className="flex items-center space-x-3">
                        <Button
                          variant="ghost"
                          onClick={() => setShowPreview(true)}
                          disabled={!validateCurrentStep()}
                        >
                          Preview Report
                        </Button>
                        
                        {currentStep < steps?.length ? (
                          <Button
                            onClick={handleNext}
                            disabled={!validateCurrentStep()}
                            iconName="ChevronRight"
                            iconPosition="right"
                          >
                            Next
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setShowPreview(true)}
                            disabled={!validateCurrentStep()}
                            iconName="Eye"
                            iconPosition="right"
                          >
                            Review & Submit
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Tips */}
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Icon name="Lightbulb" size={18} className="text-primary" />
                  <h3 className="font-semibold text-foreground">Reporting Tips</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <Icon name="Check" size={14} className="text-success mt-0.5" />
                    <span>Be specific about location and timing</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Icon name="Check" size={14} className="text-success mt-0.5" />
                    <span>Include clear photos when possible</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Icon name="Check" size={14} className="text-success mt-0.5" />
                    <span>Describe immediate health risks</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Icon name="Check" size={14} className="text-success mt-0.5" />
                    <span>Provide objective observations</span>
                  </li>
                </ul>
              </div>

              {/* Emergency Contact removed per request */}

              {/* Nearby Reports */}
              <div className="bg-card border border-border rounded-lg p-6">
                <NearbyReports />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitizenReporting;