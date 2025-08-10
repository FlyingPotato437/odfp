"use client";
import { motion } from "framer-motion";
import { Globe } from "./globe";
import { Button } from "./Button";
import { ArrowRight, Search, Database, Waves } from "lucide-react";

export function Hero() {
  // NOAA data locations for globe markers
  const noaaLocations = [
    { location: [39.0458, -76.6413] }, // Baltimore, MD - NOAA headquarters  
    { location: [25.7617, -80.1918] }, // Miami, FL - Hurricane Center
    { location: [61.2181, -149.9003] }, // Anchorage, AK - Alaska region
    { location: [21.3099, -157.8581] }, // Honolulu, HI - Pacific region
    { location: [37.7749, -122.4194] }, // San Francisco, CA - West coast
    { location: [43.0731, -70.7533] }, // Portsmouth, NH - Northeast region
    { location: [28.3922, -80.6077] }, // Cape Canaveral, FL - Satellite ops
    { location: [64.8378, -147.7164] }, // Fairbanks, AK - Arctic research
  ];

  return (
    <div className="relative min-h-[90vh] overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 dark:from-slate-950 dark:via-blue-950 dark:to-cyan-950">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(59,130,246,0.1)_25%,rgba(59,130,246,0.1)_50%,transparent_50%,transparent_75%,rgba(59,130,246,0.1)_75%)] bg-[length:20px_20px]" />
      </div>

      <div className="relative">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Column - Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="space-y-8"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
              >
                <Waves className="mr-2 h-4 w-4" />
                NOAA Ocean Data Discovery Platform
              </motion.div>

              {/* Main Heading */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="space-y-4"
              >
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
                  Discover{" "}
                  <span className="bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 bg-clip-text text-transparent">
                    Ocean Data
                  </span>
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 sm:text-xl">
                  Search, explore, and analyze authoritative oceanographic datasets from NOAA and partner institutions. 
                  Find real-time and historical data on sea surface temperature, currents, waves, marine ecosystems, and more.
                </p>
              </motion.div>

              {/* Features */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
              >
                <div className="flex items-center space-x-3">
                  <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                    <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Smart Search</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">AI-powered discovery</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="rounded-lg bg-cyan-100 p-2 dark:bg-cyan-900/30">
                    <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Live Data</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Real-time feeds</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="rounded-lg bg-teal-100 p-2 dark:bg-teal-900/30">
                    <Waves className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Ocean Focus</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Marine datasets</div>
                  </div>
                </div>
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0"
              >
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  onClick={() => {
                    const searchSection = document.getElementById('search-section');
                    searchSection?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Start Exploring Data
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => window.open('https://data.noaa.gov/onestop/', '_blank')}
                >
                  Learn About OneStop API
                </Button>
              </motion.div>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.6 }}
                className="grid grid-cols-3 gap-8 pt-8"
              >
                <div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">1000+</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Datasets</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">50+</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Data Sources</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">24/7</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Real-time</div>
                </div>
              </motion.div>
            </motion.div>

            {/* Right Column - Globe */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
              className="relative"
            >
              <div className="relative mx-auto aspect-square max-w-lg">
                {/* Glow effect behind globe */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/20 via-cyan-400/20 to-teal-400/20 blur-3xl" />
                
                {/* Globe Component */}
                <Globe 
                  markers={noaaLocations}
                  className="relative z-10 h-full w-full"
                />
                
                {/* Floating Elements */}
                <motion.div
                  className="absolute -top-4 -right-4 rounded-lg bg-white/90 p-3 shadow-lg backdrop-blur dark:bg-gray-900/90"
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 5, 0] 
                  }}
                  transition={{ 
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400">🌊 Live Ocean Data</div>
                </motion.div>
                
                <motion.div
                  className="absolute -bottom-4 -left-4 rounded-lg bg-white/90 p-3 shadow-lg backdrop-blur dark:bg-gray-900/90"
                  animate={{ 
                    y: [0, 10, 0],
                    rotate: [0, -5, 0] 
                  }}
                  transition={{ 
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1
                  }}
                >
                  <div className="text-xs font-medium text-cyan-600 dark:text-cyan-400">🛰️ Satellite Feeds</div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}