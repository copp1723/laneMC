/**
 * Lazy Loading Utilities
 * Provides optimized lazy loading components and utilities
 */

import { lazy, Suspense, ComponentType, LazyExoticComponent, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Generic loading fallback component
export function LoadingFallback({ 
  name, 
  className = "p-4", 
  variant = "default" 
}: { 
  name?: string; 
  className?: string;
  variant?: "default" | "card" | "inline" | "fullscreen" | "skeleton"
}) {
  switch (variant) {
    case "fullscreen":
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <p className="text-slate-600 animate-pulse">Loading{name ? ` ${name}` : ''}...</p>
          </div>
        </div>
      );
      
    case "card":
      return (
        <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-6 h-6 bg-slate-300 rounded animate-pulse mx-auto mb-2"></div>
              <p className="text-sm text-slate-500">Loading{name ? ` ${name}` : ''}...</p>
            </div>
          </div>
        </div>
      );
      
    case "inline":
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          <div className="w-4 h-4 bg-slate-300 rounded animate-pulse"></div>
          <span className="text-sm text-slate-500">Loading{name ? ` ${name}` : ''}...</span>
        </div>
      );
      
    case "skeleton":
      return (
        <div className={className}>
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2 mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      );
      
    case "default":
    default:
      return (
        <div className={`flex items-center justify-center ${className}`}>
          <div className="text-center">
            <div className="w-6 h-6 bg-slate-300 rounded animate-pulse mx-auto mb-2"></div>
            <p className="text-sm text-slate-500">Loading{name ? ` ${name}` : ''}...</p>
          </div>
        </div>
      );
  }
}

// Higher-order component for lazy loading with custom fallback
export function withLazyLoading<T extends object>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  fallback?: React.ReactNode,
  options?: {
    name?: string;
    variant?: "default" | "card" | "inline" | "fullscreen" | "skeleton";
    className?: string;
  }
): LazyExoticComponent<ComponentType<T>> {
  const LazyComponent = lazy(importFn);
  
  // Return a component that wraps the lazy component with Suspense
  return lazy(() => 
    Promise.resolve({
      default: function WrappedLazyComponent(props: T) {
        return (
          <Suspense 
            fallback={
              fallback || 
              <LoadingFallback 
                name={options?.name}
                variant={options?.variant}
                className={options?.className}
              />
            }
          >
            <LazyComponent {...(props as any)} />
          </Suspense>
        );
      }
    })
  );
}

// Preload utility for critical components
export function preloadComponent(importFn: () => Promise<any>): void {
  // Preload when browser is idle
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      importFn().catch(() => {
        // Silently ignore preload failures
      });
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      importFn().catch(() => {
        // Silently ignore preload failures
      });
    }, 0);
  }
}

// Intersection Observer based lazy loading hook
export function useLazyIntersection(
  threshold = 0.1,
  rootMargin = '50px'
) {
  const [isVisible, setIsVisible] = useState(false);
  const [element, setElement] = useState<Element | null>(null);

  useEffect(() => {
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [element, threshold, rootMargin]);

  return [setElement, isVisible] as const;
}

// Lazy component wrapper with intersection observer
export function LazyIntersection({
  children,
  fallback,
  className = '',
  threshold = 0.1,
  rootMargin = '50px'
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  threshold?: number;
  rootMargin?: string;
}) {
  const [setRef, isVisible] = useLazyIntersection(threshold, rootMargin);

  return (
    <div ref={setRef} className={className}>
      {isVisible ? children : (fallback || <LoadingFallback variant="skeleton" />)}
    </div>
  );
}

// Bundle splitting helper
export const bundleComponents = {
  // Analytics/Charts bundle
  analytics: {
    QuickInsights: lazy(() => import('@/components/quick-insights')),
    // Add other analytics components here
  },
  
  // Communication bundle
  communication: {
    ChatInterface: lazy(() => import('@/components/chat-interface')),
    // Add other communication components here
  },
  
  // Modal/Dialog bundle
  modals: {
    CampaignApprovalModal: lazy(() => import('@/components/campaign-approval-modal')),
    // Add other modal components here
  },
  
  // Pages bundle
  pages: {
    Dashboard: lazy(() => import('@/pages/dashboard')),
    Login: lazy(() => import('@/pages/login')),
    NotFound: lazy(() => import('@/pages/not-found')),
  }
};

// Performance monitoring for lazy loading
export function measureLazyLoadPerformance<T>(
  componentName: string,
  importFn: () => Promise<T>
): () => Promise<T> {
  return async () => {
    const startTime = performance.now();
    
    try {
      const result = await importFn();
      const loadTime = performance.now() - startTime;
      
      // Log performance in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Lazy Load] ${componentName} loaded in ${loadTime.toFixed(2)}ms`);
      }
      
      // Send to performance monitoring service in production
      if (process.env.NODE_ENV === 'production' && 'performance' in window) {
        performance.mark(`lazy-load-${componentName}-end`);
        performance.measure(
          `lazy-load-${componentName}`,
          `lazy-load-${componentName}-start`,
          `lazy-load-${componentName}-end`
        );
      }
      
      return result;
    } catch (error) {
      const loadTime = performance.now() - startTime;
      console.error(`[Lazy Load] ${componentName} failed to load after ${loadTime.toFixed(2)}ms:`, error);
      throw error;
    }
  };
}