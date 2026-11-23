/**
 * Mythara site chat widget
 *
 * Copyright (c) Mythara Labs LLC. All rights reserved.
 *
 * A client-side guide for mytharalabs.com. Every answer in the script
 * below states only what the company page itself states: the SoulCradle
 * pilots and licenses, the bots and their prices, the free Witness Gate,
 * and email support answered within 5 business days.
 */

class MytharaWidget {
    constructor() {
        // DOM elements
        this.chatBubble = document.getElementById('chat-bubble');
        this.chatWindow = document.getElementById('chat-window');
        this.chatClose = document.getElementById('chat-close');
        this.chatInput = document.getElementById('chat-input');
        this.chatSend = document.getElementById('chat-send');
        this.chatMessages = document.getElementById('chat-messages');
        this.voiceBtn = document.getElementById('voice-btn');
        this.quickRepliesContainer = document.getElementById('quick-replies');
        this.progressTracker = document.getElementById('progress-tracker');
        this.tpmoCheckbox = document.getElementById('tpmo-checkbox');
        
        // State
        this.conversationStage = 0;
        this.engagementScore = 0;
        this.sessionStartTime = Date.now();
        this.lastInteractionTime = Date.now();
        this.hasUnread = false;
        this.isTyping = false;
        this.exitIntentShown = false;
        this.userLanguage = 'en';
        
        // Speech recognition
        this.recognition = null;
        this.voicesLoaded = false;
        this.selectedVoice = null;
        this.voiceChosen = false;
        
        // Initialize
        this.init();
    }
    
    init() {
        this.setupSpeechRecognition();
        this.setupEventListeners();
        this.setupEngagementTracking();
        this.loadVoices();
        
        // Prevent duplicate initialization
        if (this.chatBubble.dataset.initialized) return;
        this.chatBubble.dataset.initialized = 'true';
    }
    
    setupSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported');
            this.voiceBtn.style.display = 'none';
            return;
        }
        
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
            
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.chatInput.value = transcript;
                this.voiceBtn.classList.remove('listening');
                this.handleSend();
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.voiceBtn.classList.remove('listening');
                
                if (event.error === 'not-allowed') {
                    this.addMessage('Microphone access denied. Please enable it in your browser settings.', false);
                }
            };
            
            this.recognition.onend = () => {
                this.voiceBtn.classList.remove('listening');
            };
        } catch (error) {
            console.error('Failed to initialize speech recognition:', error);
            this.voiceBtn.style.display = 'none';
        }
    }
    
    loadVoices() {
        if (!('speechSynthesis' in window)) {
            console.warn('Speech synthesis not supported');
            return;
        }
        
        try {
            speechSynthesis.onvoiceschanged = () => {
                this.voicesLoaded = true;
            };
        } catch (error) {
            console.error('Failed to load voices:', error);
        }
    }
    
    setupEventListeners() {
        // Chat bubble - open widget
        this.chatBubble.addEventListener('click', () => {
            this.openChat();
        });
        
        // Close button
        this.chatClose.addEventListener('click', () => {
            this.closeChat();
        });
        
        // Send button
        this.chatSend.addEventListener('click', () => {
            this.handleSend();
        });
        
        // Enter key in input
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });
        
        // Voice button
        if (this.voiceBtn) {
            this.voiceBtn.addEventListener('click', () => {
                this.handleVoiceInput();
            });
        }
        
        // TPMO checkbox - enable/disable input
        if (this.tpmoCheckbox) {
            // Disable input initially
            this.chatInput.disabled = true;
            this.chatSend.disabled = true;
            this.chatInput.placeholder = 'Please acknowledge TPMO terms to chat...';
            
            this.tpmoCheckbox.addEventListener('change', () => {
                if (this.tpmoCheckbox.checked) {
                    this.chatInput.disabled = false;
                    this.chatSend.disabled = false;
                    this.chatInput.placeholder = 'Ask me anything about Mythara...';
                    this.chatInput.focus();
                } else {
                    this.chatInput.disabled = true;
                    this.chatSend.disabled = true;
                    this.chatInput.placeholder = 'Please acknowledge TPMO terms to chat...';
                }
            });
        }
        
        // Window close - cleanup
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }
    
    setupEngagementTracking() {
        let scrollDepth = 0;
        let idleTimer = null;
        
        // Track scroll depth
        window.addEventListener('scroll', () => {
            const currentScroll = window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100;
            if (currentScroll > scrollDepth) {
                scrollDepth = currentScroll;
            }
        });
        
        // Track user activity
        const resetIdle = () => {
            this.lastInteractionTime = Date.now();
            
            if (idleTimer) clearTimeout(idleTimer);
            
            idleTimer = setTimeout(() => {
                const idleTime = (Date.now() - this.lastInteractionTime) / 1000;
                
                if (idleTime > 45 && this.chatWindow.classList.contains('active')) {
                    this.showTypingIndicator();
                    setTimeout(() => {
                        this.hideTypingIndicator();
                        this.addMessage("I'm here if you have questions. No pressure.");
                        this.clearQuickReplies();
                    }, 1000);
                }
            }, 30000);
        };
        
        document.addEventListener('mousemove', resetIdle);
        document.addEventListener('keydown', resetIdle);
        resetIdle();
        
        // Exit intent - gentle reminder only
        document.addEventListener('mouseleave', (e) => {
            if (e.clientY <= 0 && !this.exitIntentShown && this.conversationStage < 3) {
                this.exitIntentShown = true;
                if (!this.chatWindow.classList.contains('active')) {
                    this.setUnreadNotification(true);
                }
            }
        });
    }
    
    openChat() {
        this.chatWindow.classList.add('active');
        this.setUnreadNotification(false);
        this.engagementScore += 10;
        
        // Always start fresh conversation when opening
        if (this.chatMessages.children.length === 0 || !this.voiceChosen) {
            this.startConversation();
        }
        
        // Focus input
        this.chatInput.focus();
    }
    
    closeChat() {
        this.chatWindow.classList.remove('active');
        this.stopSpeech();
        
        // Mark for reset on next open
        this.voiceChosen = false;
        this.selectedVoice = null;
        this.conversationStage = 0;
        
        // Clear everything
        this.chatMessages.innerHTML = '';
        this.clearQuickReplies();
        this.updateProgress(0);
    }
    
    startConversation() {
        this.conversationStage = 0;
        this.updateProgress(0);
        
        // Auto-detect language and select appropriate voice
        this.autoSelectVoice();
        
        // Get agent name from selected voice
        const agentName = this.getAgentName();
        
        this.showTypingIndicator();
        setTimeout(() => {
            this.hideTypingIndicator();
            this.addMessage(`Hey there! I'm ${agentName}, the guide for Mythara Labs. I can answer questions about SoulCradle, the governance core every product here runs on, the bots we sell, and the free Witness Gate. What would you like to know?`, false);
            
            this.addQuickReplies(['What is SoulCradle?', 'Show pricing', 'What is the Witness Gate?']);
        }, 800);
    }
    
    getAgentName() {
        if (!this.selectedVoice) return 'Alex';
        
        const voiceName = this.selectedVoice.name;
        
        // Extract first name from voice name (e.g., "Microsoft Zira Desktop" -> "Zira")
        if (voiceName.includes('Zira')) return 'Zira';
        if (voiceName.includes('Samantha')) return 'Samantha';
        if (voiceName.includes('Karen')) return 'Karen';
        if (voiceName.includes('David')) return 'David';
        if (voiceName.includes('Mark')) return 'Mark';
        if (voiceName.includes('James')) return 'James';
        if (voiceName.includes('Susan')) return 'Susan';
        if (voiceName.includes('Victoria')) return 'Victoria';
        if (voiceName.includes('Daniel')) return 'Daniel';
        
        // Language-based names
        if (this.selectedVoice.lang.startsWith('es')) return 'Sofia';
        if (this.selectedVoice.lang.startsWith('fr')) return 'Amélie';
        if (this.selectedVoice.lang.startsWith('zh')) return 'Wei';
        if (this.selectedVoice.lang.startsWith('ja')) return 'Yuki';
        if (this.selectedVoice.lang.startsWith('en-IN')) return 'Priya';
        
        // Gender-based fallback
        if (voiceName.toLowerCase().includes('female')) return 'Maya';
        if (voiceName.toLowerCase().includes('male')) return 'Alex';
        
        return 'Jordan'; // Gender-neutral fallback
    }
    
    autoSelectVoice() {
        this.voiceChosen = true;
        if (!('speechSynthesis' in window)) {
            this.selectedVoice = null;
            return;
        }
        const voices = speechSynthesis.getVoices();
        
        // Detect user's language from browser
        const userLang = navigator.language || navigator.userLanguage || 'en-US';
        console.log('User language detected:', userLang);
        
        // Build voice pool that matches user's language
        let voicePool = [];
        
        // Match voices to user's language
        if (userLang.startsWith('en')) {
            // English speakers get English voices
            voicePool = voices.filter(v => v.lang.startsWith('en'));
        } else if (userLang.startsWith('es')) {
            // Spanish speakers get Spanish voices
            voicePool = voices.filter(v => v.lang.startsWith('es'));
        } else if (userLang.startsWith('fr')) {
            // French speakers get French voices
            voicePool = voices.filter(v => v.lang.startsWith('fr'));
        } else if (userLang.startsWith('zh')) {
            // Chinese speakers get Chinese voices
            voicePool = voices.filter(v => v.lang.startsWith('zh'));
        } else if (userLang.startsWith('ja')) {
            // Japanese speakers get Japanese voices
            voicePool = voices.filter(v => v.lang.startsWith('ja'));
        } else if (userLang.startsWith('de')) {
            // German speakers get German voices
            voicePool = voices.filter(v => v.lang.startsWith('de'));
        } else if (userLang.startsWith('hi')) {
            // Hindi speakers get Hindi/Indian voices
            voicePool = voices.filter(v => v.lang.startsWith('hi') || v.lang === 'en-IN');
        } else {
            // Fallback to English for unsupported languages
            voicePool = voices.filter(v => v.lang.startsWith('en'));
        }
        
        // Randomly select from the language-matched pool
        if (voicePool.length > 0) {
            this.selectedVoice = voicePool[Math.floor(Math.random() * voicePool.length)];
            console.log('Selected voice:', this.selectedVoice.name, '(' + this.selectedVoice.lang + ')');
        } else {
            this.selectedVoice = null;
            console.log('No voices available for', userLang, '- text only mode');
        }
    }
    
    handleSend() {
        const text = this.chatInput.value.trim();
        if (!text || this.isTyping) return;
        
        // Stop any ongoing speech when user sends a message
        this.stopSpeech();
        
        this.addMessage(text, true);
        this.chatInput.value = '';
        this.clearQuickReplies();
        this.lastInteractionTime = Date.now();
        this.engagementScore += 5;
        
        // Get response
        this.isTyping = true;
        this.showTypingIndicator();
        
        // Natural delay (500-1000ms)
        const delay = 500 + Math.random() * 500;
        setTimeout(() => {
            this.hideTypingIndicator();
            const response = this.getResponse(text);
            this.addMessage(response);
            this.isTyping = false;
            
            // Update progress
            const progressMap = { 0: 0, 1: 25, 2: 50, 3: 75, 4: 100 };
            this.updateProgress(progressMap[this.conversationStage] || 0);
            
            // Suggest next step
            setTimeout(() => {
                this.suggestNextStep(text);
            }, 1500);
        }, delay);
    }
    
    handleVoiceInput() {
        if (!this.recognition) {
            this.addMessage('Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.');
            return;
        }
        
        // Stop any ongoing speech when user clicks microphone
        this.stopSpeech();
        
        if (this.voiceBtn.classList.contains('listening')) {
            this.recognition.stop();
            this.voiceBtn.classList.remove('listening');
        } else {
            try {
                this.voiceBtn.classList.add('listening');
                this.recognition.start();
            } catch (error) {
                console.error('Failed to start speech recognition:', error);
                this.voiceBtn.classList.remove('listening');
                this.addMessage('Failed to start voice input. Please try again.');
            }
        }
    }
    
    getResponse(message) {
        const lowerInput = message.toLowerCase();
        this.conversationStage = Math.min(this.conversationStage + 1, 4);

        // What is Mythara / SoulCradle
        if (lowerInput.includes('what is') || lowerInput.includes('mythara') || lowerInput.includes('soulcradle') || lowerInput.includes('soul cradle') || lowerInput.includes('governance')) {
            return "Mythara Labs LLC is a Denver software company built around one governance core: SoulCradle. SoulCradle checks every action an AI agent proposes before it runs, against compliance rules with a benevolence engine woven through them, and seals every judgment in a tamper-evident record that stays in your own environment. Regulated teams license SoulCradle itself. Our other products, a training simulation, readiness assessments, and a shelf of working bots, are built on the same core. Want the pricing, or the free Witness Gate first?";
        }

        // Pricing / Cost
        if (lowerInput.includes('pricing') || lowerInput.includes('cost') || lowerInput.includes('price') || lowerInput.includes('how much')) {
            return "SoulCradle starts with a 90-day pilot: $5,000 self-guided or $15,000 white-glove, and either pilot is credited in full toward the first annual license if you convert. After that, Commercial licensing is $24,000 per year and Enterprise starts at $75,000 per year. The bots are one-time prices from $750 to $3,500, or $14,900 for the full suite of fifteen. The Witness Gate is free and open source. Which would you like to hear more about?";
        }

        // Frameworks / Compliance
        if (lowerInput.includes('framework') || lowerInput.includes('regulation') || lowerInput.includes('compliance') || lowerInput.includes('hipaa') || lowerInput.includes('gdpr') || lowerInput.includes('soc 2')) {
            return "The governance core maps controls against the frameworks the regulated world runs on: the HIPAA Security Rule, FDA 21 CFR Part 11, SOC 2, and ISO 27001, organized in a multi-jurisdiction matrix. The work is readiness mapping, controls checked against each framework and cited to the rule version they were judged under. It is stated as readiness mapping, never as certification. Our readiness assessments are sold as engagements on exactly those terms.";
        }

        // Security / SERE
        if (lowerInput.includes('adversarial') || lowerInput.includes('security') || lowerInput.includes('attack') || lowerInput.includes('sere') || lowerInput.includes('loophole')) {
            return "On the governing side, eight witnesses judge every proposed action under versioned rubrics before it executes, and three findings can block outright: deception under Eros, deception under Hermes, and disproportionate harm under Nemesis. Every judgment is sealed into a hash-chained record. On the tooling side, SERE is our guarding line: SERE Legacy does sandboxed specimen analysis for training and triage at $2,500, and SERE Desktop is a single-machine Windows security suite at $3,500. SERE Enterprise is in development and is not sold. SERE guards; it never attacks.";
        }

        // Legal indemnification
        if (lowerInput.includes('indemnif') || lowerInput.includes('legal') || lowerInput.includes('liability') || lowerInput.includes('coverage')) {
            return "No indemnification is currently offered on any product. The license terms are the ones accepted at checkout, and fees are non-refundable except as stated in Sections 7.2 and 11.4 of those terms. For anything specific, email info@mytharalabs.com.";
        }

        // ROI / Business case
        if (lowerInput.includes('roi') || lowerInput.includes('return') || lowerInput.includes('save') || lowerInput.includes('business case') || lowerInput.includes('worth')) {
            return "The case for SoulCradle is the record: every agent action judged before it runs, blocked when it should be, and provable afterward from a sealed ledger your own team holds. We do not publish an ROI calculator or promise savings figures. The honest way to judge it is the 90-day pilot on your own agent actions, $5,000 self-guided, credited in full toward the first annual license if you convert.";
        }

        // How it works / Technical
        if (lowerInput.includes('how') || lowerInput.includes('technical') || lowerInput.includes('api') || lowerInput.includes('integrate') || lowerInput.includes('work')) {
            return "SoulCradle is delivered software. It runs in your environment, your cloud, your servers, or air-gapped, and the judgment record is generated and kept there; Mythara Labs does not receive your data. There is no hosted sandbox key to hand out. To see the gate work today, the Witness Gate is free and open source on GitHub, and the demo on this page runs the same verdict rules in your browser.";
        }

        // Industries
        if (lowerInput.includes('industry') || lowerInput.includes('who uses') || lowerInput.includes('healthcare') || lowerInput.includes('finance') || lowerInput.includes('defense')) {
            return "SoulCradle is built for regulated teams: healthcare, financial services, pharma, and defense are the natural fits, because those are the worlds the readiness mapping covers, the HIPAA Security Rule, FDA 21 CFR Part 11, SOC 2, and ISO 27001. Which of those is closest to your work?";
        }

        // Competition / Alternatives
        if (lowerInput.includes('competitor') || lowerInput.includes('alternative') || lowerInput.includes('versus') || lowerInput.includes('compare')) {
            return "You could build governance yourself or use other compliance tools. The difference here is the shape of the thing: judgments are made before actions run, by eight witnesses under versioned rubrics, and the sealed record stays in your building, verifiable without us. The free Witness Gate lets you test that claim before you spend anything.";
        }

        // Implementation / Onboarding
        if (lowerInput.includes('implement') || lowerInput.includes('onboard') || lowerInput.includes('getting started') || lowerInput.includes('setup') || lowerInput.includes('start')) {
            return "A pilot runs 90 days on your own agent actions. Delivery begins within 5 business days of the pilot fee. Support is by email, answered within 5 business days. To start, buy a pilot on this page or email info@mytharalabs.com with questions first.";
        }

        // Support
        if (lowerInput.includes('support') || lowerInput.includes('help') || lowerInput.includes('assistance')) {
            return "Support is by email at info@mytharalabs.com, answered within 5 business days. That is the support term on the pilots, the licenses, and the bots alike.";
        }

        // Data privacy
        if (lowerInput.includes('privacy') || lowerInput.includes('data') || lowerInput.includes('encryption')) {
            return "Your record stays in your building. SoulCradle runs in your environment and the judgment record it produces is generated and kept there. Mythara Labs does not receive your data, and any ledger you export verifies on its own, every seal re-checked, without our involvement.";
        }

        // Contract / Terms
        if (lowerInput.includes('contract') || lowerInput.includes('commitment') || lowerInput.includes('term') || lowerInput.includes('cancel') || lowerInput.includes('refund')) {
            return "Pilots are 90 days and are credited in full toward the first annual license if you convert. License and bot fees are one-time or annual as listed, and non-refundable except as stated in Sections 7.2 and 11.4 of the terms accepted at checkout. For a specific situation, email info@mytharalabs.com.";
        }

        // Proof / Case studies
        if (lowerInput.includes('proof') || lowerInput.includes('case study') || lowerInput.includes('customer') || lowerInput.includes('reference') || lowerInput.includes('news')) {
            return "The proof is public. The Mythara News Network runs this same system in the open every night: the witnesses judge the day's stories and the print and radio editions are published free for anyone to check against the record. The Witness Gate code and its 47 passing tests are on GitHub. We do not name customers publicly.";
        }

        // Bots
        if (lowerInput.includes('bot') || lowerInput.includes('suite') || lowerInput.includes('buy')) {
            return "The bots are working products that run locally on your own machine, each with its own local database, tested end to end before listing. Prices run from $750 for QuickFix and the VoIP call tracker, through the VP and suite bots at $1,500, SERE Legacy and A.M.I.R. and the Legal Team Suite at $2,500, and SERE Desktop at $3,500. All fifteen together are $14,900, against $24,350 bought separately. Delivery is automatic after checkout. The full shelf is in the Bots section of this page.";
        }

        // Witness Gate
        if (lowerInput.includes('witness') || lowerInput.includes('gate') || lowerInput.includes('free') || lowerInput.includes('open source')) {
            return "The Witness Gate is the free, open-source piece: the same eight-witness judgment gate SoulCradle runs, in stdlib-only Python under Apache-2.0, with 47 passing tests. Code: github.com/MytharaLabsLLC/witness-gate. Run the gate before you ever talk to us.";
        }

        // Startup / small teams
        if (lowerInput.includes('startup') || lowerInput.includes('small') || lowerInput.includes('seed') || lowerInput.includes('nonprofit')) {
            return "There are no separate startup or nonprofit tiers. The honest entry points are the Witness Gate, which is free, a single bot from $750, or the Self-Guided pilot at $5,000 for 90 days on your own agent actions. Prices are the same for everyone and they are all on this page.";
        }

        // Enterprise
        if (lowerInput.includes('enterprise')) {
            return "Enterprise licensing starts at $75,000 per year: annual SoulCradle licensing for enterprise use, with the same sealed record kept in your environment. SERE Enterprise, the fleet direction of SERE, is in development and is not sold yet. Email info@mytharalabs.com to talk through an enterprise engagement.";
        }

        // On-premise / air-gapped
        if (lowerInput.includes('on-premise') || lowerInput.includes('on premise') || lowerInput.includes('air-gapped') || lowerInput.includes('air gapped') || lowerInput.includes('government')) {
            return "Yes. SoulCradle is delivered software and can run in your cloud, on your servers, or air-gapped. The judgment record is generated and kept in your environment either way. Email info@mytharalabs.com for deployment details.";
        }

        // Email address given: this chat cannot take it anywhere
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        if (emailPattern.test(lowerInput)) {
            return "Thank you. One honest note: this chat does not save or send anything, so I cannot pass that address to the team. Please email info@mytharalabs.com directly and we will answer within 5 business days.";
        }

        // Yes
        if (lowerInput.includes('yes') || lowerInput.includes('sure') || lowerInput.includes('okay')) {
            return "Great. The fastest routes are the Buy buttons on this page, or email info@mytharalabs.com and we will answer within 5 business days. What else would you like to know?";
        }

        // No
        if (lowerInput.includes('no thanks') || lowerInput.includes('not interested')) {
            return "No problem. The Witness Gate stays free if you ever want to test the system, and the News Network publishes every night. Anything else I can answer?";
        }

        // Short input
        if (lowerInput.length < 3) {
            return "I need a bit more context. What are you curious about? Pricing, the bots, the Witness Gate, or how SoulCradle works?";
        }

        // Question fallback
        if (lowerInput.includes('?')) {
            return "That one deserves a proper answer from a person. Email info@mytharalabs.com and we will answer within 5 business days. Meanwhile, I can help with pricing, the bots, the Witness Gate, or how SoulCradle works.";
        }

        // Final fallback
        return "I am not sure I follow. You can ask me what SoulCradle is, what anything costs, what the bots do, or how the Witness Gate works.";
    }

    suggestNextStep(userInput) {
        const lower = userInput.toLowerCase();
        
        // If they asked about governance, suggest pricing
        if (lower.includes('governance') || lower.includes('what is') && this.conversationStage < 3) {
            this.showTypingIndicator();
            setTimeout(() => {
                this.hideTypingIndicator();
                this.addMessage("Want to see pricing for your company size?");
                this.addQuickReplies(['Yes, show pricing', 'Tell me about frameworks', 'ROI examples']);
            }, 1000);
        }
        
        // If they asked about pricing, push to action
        else if ((lower.includes('pricing') || lower.includes('cost')) && this.conversationStage < 3) {
            this.showTypingIndicator();
            setTimeout(() => {
                this.hideTypingIndicator();
                this.addMessage("Which tier fits your current stage?");
                this.addQuickReplies(['Self-Guided pilot', 'White-Glove pilot', 'See the bots']);
            }, 1000);
        }
        
        // If they asked about frameworks, push to ROI
        else if (lower.includes('framework') && this.conversationStage < 3) {
            this.showTypingIndicator();
            setTimeout(() => {
                this.hideTypingIndicator();
                this.addMessage("Want the plain business case instead?");
                this.addQuickReplies(['Yes, the business case', 'Show pricing', 'Technical details']);
            }, 1000);
        }
    }
    
    addMessage(text, isUser = false) {
        const msg = document.createElement('div');
        msg.className = `chat-message ${isUser ? 'user' : 'bot'}`;
        
        // Support HTML for formatting but sanitize user input
        if (text.includes('<') && !isUser) {
            msg.innerHTML = text;
        } else {
            msg.textContent = text;
        }
        
        this.chatMessages.appendChild(msg);
        this.scrollToBottom();
        
        // Speak bot messages (with error handling)
        if (!isUser) {
            this.speakMessage(text);
        }
    }
    
    speakMessage(text) {
        if (!('speechSynthesis' in window) || !this.voicesLoaded) return;
        
        try {
            // Clean text for natural speech
            const spokenText = text
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/\*\*/g, '') // Remove markdown bold
                .replace(/24\/7/g, '24 7') // Say "24 7" instead of "24/7"
                .replace(/\$/g, 'dollar ') // Say "dollar" instead of symbol
                .replace(/€/g, 'euro ') // Say "euro" instead of symbol
                .replace(/£/g, 'pound ') // Say "pound" instead of symbol
                .replace(/(\d+)x/gi, '$1 times') // Say "14 times" instead of "14x"
                .replace(/(\d+)K\s*-\s*(\d+)K/gi, '$1 thousand to $2 thousand') // "14K - 30K" -> "14 thousand to 30 thousand"
                .replace(/(\d+)M\s*-\s*(\d+)M/gi, '$1 million to $2 million') // "2M - 5M" -> "2 million to 5 million"
                .replace(/\d+K/g, (match) => match.replace('K', ' thousand'))
                .replace(/\d+M/g, (match) => match.replace('M', ' million'))
                .replace(/%/g, ' percent')
                .replace(/&/g, ' and ')
                .replace(/#/g, ' number ')
                .replace(/@/g, ' at ')
                .replace(/\+/g, ' plus ')
                .replace(/, /g, ', ') // Long dash = pause (comma)
                .replace(/, /g, ', ') // En dash = pause (comma)
                .replace(/ - /g, ' to ') // Say "to" instead of dash with spaces
                .replace(/-/g, ' ') // Remove remaining dashes (like tic-tac-toe)
                .replace(/\.\.\./g, ', ')
                .replace(/[^\w\s.,!?']/g, '') // Remove other special characters
                .substring(0, 300); // Limit length
            
            const utterance = new SpeechSynthesisUtterance(spokenText);
            
            // Use user-selected voice or skip if they chose text only
            if (this.selectedVoice === null && this.voiceChosen) {
                return; // User chose "Text only"
            }
            
            if (this.selectedVoice) {
                utterance.voice = this.selectedVoice;
                console.log('Using voice:', this.selectedVoice.name);
            }
            
            utterance.rate = 0.95;
            utterance.pitch = 1.0;
            utterance.volume = 0.8;
            
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event.error);
            };
            
            speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Failed to speak message:', error);
        }
    }
    
    stopSpeech() {
        if ('speechSynthesis' in window) {
            try {
                speechSynthesis.cancel();
            } catch (error) {
                console.error('Failed to stop speech:', error);
            }
        }
    }
    
    showTypingIndicator() {
        if (document.getElementById('typing-indicator')) return;
        
        const typing = document.createElement('div');
        typing.className = 'chat-message bot typing-indicator';
        typing.id = 'typing-indicator';
        typing.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
        this.chatMessages.appendChild(typing);
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
    }
    
    addQuickReplies(suggestions) {
        this.clearQuickReplies();
        
        suggestions.forEach(text => {
            const btn = document.createElement('button');
            btn.className = 'quick-reply';
            btn.textContent = text;
            btn.onclick = () => {
                this.chatInput.value = text;
                this.handleSend();
                this.clearQuickReplies();
            };
            this.quickRepliesContainer.appendChild(btn);
        });
    }
    
    clearQuickReplies() {
        this.quickRepliesContainer.innerHTML = '';
    }
    
    updateProgress(percentage) {
        if (this.progressTracker) {
            this.progressTracker.style.width = percentage + '%';
        }
    }
    
    setUnreadNotification(unread) {
        this.hasUnread = unread;
        if (unread) {
            this.chatBubble.classList.add('has-unread');
        } else {
            this.chatBubble.classList.remove('has-unread');
        }
    }
    
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    cleanup() {
        this.stopSpeech();
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('Failed to stop recognition:', error);
            }
        }
    }
}

// Initialize widget when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new MytharaWidget();
    });
} else {
    new MytharaWidget();
}
