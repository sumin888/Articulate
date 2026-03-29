"use client";

import { useState, useEffect } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  BookOpen, 
  User, 
  Bot,
  ChevronRight,
  Award,
  TrendingUp,
  Target,
  Lightbulb
} from "lucide-react";

const sessionMessages = [
  {
    type: "ai",
    text: "I've reviewed your notes on Chapter 5 and the theme of illusion versus reality. This is a graded session — your responses will be scored against the rubric your instructor uploaded. Let's start broad and then go deeper.",
  },
  {
    type: "ai",
    text: "In your own words, what happens in Chapter 5 and why does it matter to the novel?",
  },
  {
    type: "student",
    text: "Gatsby finally reunites with Daisy at Nick's house. He's been waiting for this moment for five years and he's totally nervous. When they meet it's awkward at first but then Gatsby starts showing off his mansion and his shirts and stuff. It matters because you see how much he's built his whole life around getting Daisy back.",
  },
  {
    type: "ai",
    text: "Good starting point. You said Gatsby built his life around getting Daisy back. What does the shirt scene specifically tell us about what Gatsby is actually after — is it Daisy, or something else?",
  },
  {
    type: "student",
    text: "I think it's more like… the idea of Daisy? Like he's not really seeing her as a person, he's seeing her as proof that he made it. The shirts are about showing her how successful he is, not really about her.",
  },
  {
    type: "ai",
    text: "That's a strong observation. Now connect it to the theme. How does that reading — Gatsby pursuing an idea rather than a person — relate to the theme of illusion versus reality?",
  },
  {
    type: "student",
    text: "The illusion is his version of Daisy, the one he's been imagining for five years. The reality is the actual Daisy standing in front of him, who has moved on and changed. He can't see the difference. He's been chasing something that doesn't exist anymore.",
  },
  {
    type: "ai",
    text: "Good. There's a moment in the chapter where Nick observes Gatsby's reaction when he finally sees Daisy. What does Fitzgerald actually write — what does Gatsby's expression or behavior reveal?",
  },
  {
    type: "student", 
    text: "Nick says something like Gatsby looked at Daisy in a way that… I think he says the colossal significance of the green light had vanished? No wait, that's later. In Chapter 5 I think Nick notices that Gatsby seems almost disappointed — like the reality doesn't match what he imagined.",
  },
  {
    type: "ai",
    text: "You're close — that tension is exactly right. Nick narrates that the colossal significance of the light had now vanished forever, that Gatsby's count of enchanted objects had diminished by one. What does Fitzgerald mean by \"enchanted objects\" — and what does it tell us about the nature of Gatsby's dream?",
  },
  {
    type: "student",
    text: "The enchanted objects are the things he's assigned meaning to — the green light, Daisy, the mansion. They're enchanted because in his mind they represent something bigger than themselves. When Daisy is finally there in person, the green light loses its magic because it was only powerful as a symbol of something he didn't have yet. Now that she's there it's just a light.",
  },
];

const rubricScores = [
  { criterion: "Accurate reading of textual evidence", predicted: 15, max: 20 },
  { criterion: "Analysis of theme with supporting argument", predicted: 25, max: 30 },
  { criterion: "Ability to connect to broader novel", predicted: 22, max: 25 },
  { criterion: "Clarity and coherence of reasoning", predicted: 19, max: 25 },
];

const totalPredicted = rubricScores.reduce((sum, s) => sum + s.predicted, 0);
const totalMax = rubricScores.reduce((sum, s) => sum + s.max, 0);

export function SampleSession() {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    
    if (currentMessageIndex < sessionMessages.length) {
      const timer = setTimeout(() => {
        setCurrentMessageIndex(prev => prev + 1);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      setIsPlaying(false);
      setShowResults(true);
    }
  }, [isPlaying, currentMessageIndex]);

  const handlePlay = () => {
    if (currentMessageIndex >= sessionMessages.length) {
      setCurrentMessageIndex(0);
      setShowResults(false);
    }
    setIsPlaying(true);
  };

  const handlePause = () => setIsPlaying(false);

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentMessageIndex(0);
    setShowResults(false);
  };

  const handleSkipToEnd = () => {
    setIsPlaying(false);
    setCurrentMessageIndex(sessionMessages.length);
    setShowResults(true);
  };

  const visibleMessages = sessionMessages.slice(0, currentMessageIndex);

  return (
    <section id="demo" className="py-24 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            See It In Action
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
            A real{" "}
            <span className="text-primary">evaluation session</span>
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-muted-foreground text-pretty">
            Watch how Articulate guides a student through analyzing The Great Gatsby, 
            adapting questions based on their responses and revealing deeper understanding.
          </p>
        </div>

        {/* Session info banner */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="flex flex-wrap items-center justify-center gap-4 p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">AP Literature</span>
            </div>
            <div className="w-px h-4 bg-border hidden sm:block" />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Topic:</span>
              <span className="font-medium text-foreground">The Great Gatsby — Illusion vs. Reality</span>
            </div>
            <div className="w-px h-4 bg-border hidden sm:block" />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Student:</span>
              <span className="font-medium text-foreground">High School Junior</span>
            </div>
          </div>
        </div>

        {/* Main session container */}
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl bg-card border border-border overflow-hidden shadow-xl">
            {/* Session header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-2 text-sm font-medium text-foreground">Evaluation Mode</span>
              </div>
              
              {/* Playback controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  title="Reset"
                >
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                </button>
                {isPlaying ? (
                  <button
                    onClick={handlePause}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={handlePlay}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    {currentMessageIndex === 0 ? "Play Session" : "Continue"}
                  </button>
                )}
                <button
                  onClick={handleSkipToEnd}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-muted text-sm text-muted-foreground transition-colors"
                >
                  Skip to Results
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div className="h-[400px] overflow-y-auto p-6 space-y-4">
              {visibleMessages.length === 0 && !showResults && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Play className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground">Click &quot;Play Session&quot; to watch the evaluation unfold</p>
                </div>
              )}

              {visibleMessages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${message.type === "student" ? "flex-row-reverse" : ""} animate-fade-in-up`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.type === "ai" 
                      ? "bg-primary/10" 
                      : "bg-secondary/10"
                  }`}>
                    {message.type === "ai" ? (
                      <Bot className="w-4 h-4 text-primary" />
                    ) : (
                      <User className="w-4 h-4 text-secondary" />
                    )}
                  </div>
                  <div className={`max-w-[80%] p-4 rounded-2xl ${
                    message.type === "ai"
                      ? "bg-muted text-foreground rounded-tl-sm"
                      : "bg-primary text-primary-foreground rounded-tr-sm"
                  }`}>
                    <p className="text-sm leading-relaxed">{message.text}</p>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isPlaying && currentMessageIndex < sessionMessages.length && (
                <div className={`flex gap-3 ${sessionMessages[currentMessageIndex].type === "student" ? "flex-row-reverse" : ""}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    sessionMessages[currentMessageIndex].type === "ai" 
                      ? "bg-primary/10" 
                      : "bg-secondary/10"
                  }`}>
                    {sessionMessages[currentMessageIndex].type === "ai" ? (
                      <Bot className="w-4 h-4 text-primary" />
                    ) : (
                      <User className="w-4 h-4 text-secondary" />
                    )}
                  </div>
                  <div className={`p-4 rounded-2xl ${
                    sessionMessages[currentMessageIndex].type === "ai"
                      ? "bg-muted rounded-tl-sm"
                      : "bg-primary/20 rounded-tr-sm"
                  }`}>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Results panel */}
              {showResults && (
                <div className="animate-fade-in-up mt-6 space-y-6">
                  {/* Score card */}
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 border border-primary/20">
                    <div className="flex items-center gap-3 mb-4">
                      <Award className="w-6 h-6 text-primary" />
                      <h3 className="font-display text-xl font-bold text-foreground">Session Results</h3>
                    </div>
                    
                    <div className="flex items-center gap-4 mb-6">
                      <div className="text-5xl font-bold text-primary">{totalPredicted}</div>
                      <div className="text-2xl text-muted-foreground">/ {totalMax}</div>
                      <div className="ml-auto px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium">
                        Predicted Score
                      </div>
                    </div>

                    {/* Rubric breakdown */}
                    <div className="space-y-3">
                      {rubricScores.map((score, index) => (
                        <div key={index} className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-foreground">{score.criterion}</span>
                              <span className="text-muted-foreground">{score.predicted}/{score.max}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div 
                                className="h-full rounded-full bg-primary transition-all duration-1000"
                                style={{ width: `${(score.predicted / score.max) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feedback cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-semibold text-green-700 dark:text-green-400">Strength</span>
                      </div>
                      <p className="text-sm text-green-800 dark:text-green-300">
                        Your analysis of the green light passage — that it loses power precisely because the dream has been achieved — showed real engagement with how Fitzgerald uses symbols.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Area to Develop</span>
                      </div>
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        Your textual evidence was shaky in places — you were unsure which passage you were referring to and had to be prompted to locate it.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Next Step</span>
                      </div>
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        Go back to Chapter 5 and annotate every moment where Gatsby&apos;s reaction to Daisy seems off or strained.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="px-6 py-3 border-t border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Progress</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${(currentMessageIndex / sessionMessages.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{currentMessageIndex}/{sessionMessages.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
