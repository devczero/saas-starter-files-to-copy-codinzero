'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserResponse } from '@/types/user';
import { UserButton } from '@clerk/nextjs';
import YouTubeInput from '../components/YouTubeInput';
import ProgressIndicator from '../components/ProgressIndicator';
import TranscriptResults from '../components/TranscriptResults';
import ErrorDisplay from '../components/ErrorDisplay';
import AnalysisResults from '../components/AnalysisResults';
import SavedAnalysesList from '../components/SavedAnalysesList';
import Link from 'next/link';

interface TranscriptEntry {
  text: string;
  start: number;
  duration: number;
}

export default function Dashboard() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [summary, setSummary] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>('')
  const [userData, setUserData] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[] | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const totalSteps = 5; // Added one more step for AI analysis

  const isSubscribed = userData?.subscription?.status === 'active';

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/user');
        
        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }
        
        const data: UserResponse = await response.json();
        setUserData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match && match[1] ? match[1] : null;
  };

  const handleSubmit = async (url: string) => {
    try {
      // Reset states
      setIsLoading(true);
      setIsAnalyzing(false);
      setError(null);
      setAnalysis(null);
      setTranscript(null);
      setCurrentStep(1); // Validating URL

      // Extract video ID
      const extractedVideoId = extractVideoId(url);
      if (!extractedVideoId) {
        throw new Error('Invalid YouTube URL');
      }
      
      setVideoId(extractedVideoId);
      setCurrentStep(2); // Fetching video details

      // Fetch transcript
      const response = await fetch('/api/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl: url }),
      });

      setCurrentStep(3); // Extracting transcript

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch transcript');
      }

      const data = await response.json();
      
      setCurrentStep(4); // Processing data

      // Process transcript data
      if (!data.transcript || !data.transcript.length) {
        throw new Error('No transcript available for this video');
      }

      // Store transcript but don't display it
      setTranscript(data.transcript);
      setIsLoading(false);
      
      // Start AI analysis
      setCurrentStep(5); // Analyzing transcript
      setIsAnalyzing(true);
      
      try {
        const analysisResponse = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transcript: data.transcript }),
        });

        if (!analysisResponse.ok) {
          const errorData = await analysisResponse.json();
          throw new Error(errorData.error || 'Failed to analyze transcript');
        }

        const analysisData = await analysisResponse.json();
        setAnalysis(analysisData.analysis);
      } catch (analysisError) {
        console.error('Analysis error:', analysisError);
        setError(analysisError instanceof Error ? analysisError.message : 'Failed to analyze transcript');
      } finally {
        setIsAnalyzing(false);
      }
    } catch (err) {
      setIsLoading(false);
      setIsAnalyzing(false);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  const handleReset = () => {
    setIsLoading(false);
    setIsAnalyzing(false);
    setCurrentStep(0);
    setError(null);
    setTranscript(null);
    setAnalysis(null);
    setVideoId(null);
  };

  if (!isSubscribed) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="space-y-4 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">&larr; Back</Link>
          <h2 className="border-b pb-2 text-3xl font-semibold tracking-tight">Premium Access Required</h2>
          <p className="leading-7">Please subscribe to access this feature</p>
          <Link href="/pricing">
            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
              View Plans
            </button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <main className="space-y-8">
        <div className="space-y-4 rounded-lg border bg-card text-card-foreground shadow-sm p-6">

          <div className="py-2 border-b pb-4">
            <p className="text-sm font-medium text-emerald-500 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Subscription Active
            </p>
          </div>

          {!transcript && !error && (
            <YouTubeInput onSubmit={handleSubmit} isLoading={isLoading} />
          )}

          {isLoading && currentStep > 0 && (
            <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} />
          )}

          {error && (
            <ErrorDisplay message={error} onRetry={handleReset} />
          )}

          {transcript && videoId && !error && (
            <>
              <TranscriptResults 
                videoId={videoId} 
                onReset={handleReset} 
              />
              <AnalysisResults 
                analysis={analysis} 
                isLoading={isAnalyzing}
                videoId={videoId}
              />
            </>
          )}
        </div>

        {/* Saved Analyses List */}
        {!isLoading && (
          <div className="space-y-4 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <h2 className="border-b pb-2 text-2xl font-semibold tracking-tight">Saved Analyses</h2>
            <SavedAnalysesList />
          </div>
        )}
      </main>
    </div>
  )
}