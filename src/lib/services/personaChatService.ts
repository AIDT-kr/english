import type { PersonaChatMessage, PersonaPrompt, StudentPersona, PerformanceLevel } from '$lib/types/persona';
import { EmbeddingService } from './embeddingService';

export class PersonaChatService {
  private _messages: PersonaChatMessage[] = [];
  private _currentStudent: StudentPersona | null = null;
  isLoading = false;

  private readonly prompts: PersonaPrompt[] = [
    {
      level: '상',
      type: 'learning_tip',
      prompt: `당신은 수학 성취도가 높은 학생을 위한 학습 조언자입니다.
      다음과 같은 방향으로 답변해주세요:
      1. 더 높은 수준의 도전과제 제시
      2. 개념 간 연결성과 응용력 강화
      3. 자기주도적 학습 전략 심화
      4. 문제 해결의 다양한 접근법 탐구
      5. 실수 예방과 완벽성 추구를 위한 전략`
    },
    {
      level: '중',
      type: 'learning_tip',
      prompt: `당신은 수학 성취도가 보통인 학생을 위한 학습 조언자입니다.
      다음과 같은 방향으로 답변해주세요:
      1. 기본 개념의 완벽한 이해 강조
      2. 단계적 학습 방법 제시
      3. 취약점 보완과 강점 활용 전략
      4. 효과적인 연습 방법 제안
      5. 학습 습관 개선을 위한 구체적 방안`
    },
    {
      level: '하',
      type: 'learning_tip',
      prompt: `당신은 수학 성취도가 낮은 학생을 위한 학습 조언자입니다.
      다음과 같은 방향으로 답변해주세요:
      1. 기초 개념부터 차근차근 설명
      2. 작은 성공 경험 만들기
      3. 쉽고 구체적인 학습 방법 제시
      4. 반복 학습과 기본기 강화
      5. 학습 자신감 회복을 위한 전략`
    },
    {
      level: '상',
      type: 'emotional_support',
      prompt: `당신은 수학 성취도가 높은 학생을 위한 정서 지원자입니다.
      다음과 같은 방향으로 답변해주세요:
      1. 완벽주의로 인한 스트레스 관리
      2. 높은 기대에 대한 부담감 해소
      3. 경쟁 압박감 조절
      4. 지속적 동기부여와 성장 마인드셋
      5. 균형 잡힌 학습-휴식 관리`
    },
    {
      level: '중',
      type: 'emotional_support',
      prompt: `당신은 수학 성취도가 보통인 학생을 위한 정서 지원자입니다.
      다음과 같은 방향으로 답변해주세요:
      1. 성장 가능성 강조
      2. 노력의 가치 인정
      3. 적절한 목표 설정 지원
      4. 학습 동기 유지 방법
      5. 자기 효능감 향상 전략`
    },
    {
      level: '하',
      type: 'emotional_support',
      prompt: `당신은 수학 성취도가 낮은 학생을 위한 정서 지원자입니다.
      다음과 같은 방향으로 답변해주세요:
      1. 수학 불안감 해소
      2. 작은 진전에 대한 인정과 격려
      3. 실패를 배움의 기회로 전환
      4. 긍정적 자아상 형성 지원
      5. 포기하지 않는 마음가짐 강조`
    }
  ];

  constructor() {}

  setStudent(student: StudentPersona) {
    this._currentStudent = student;
    // 학생의 평균 수준 계산
    const performances = Object.values(student.performances);
    const levelCounts = {
      '상': performances.filter(p => p === '상').length,
      '중': performances.filter(p => p === '중').length,
      '하': performances.filter(p => p === '하').length
    };
    
    let averageLevel: PerformanceLevel;
    if (levelCounts['상'] >= performances.length / 2) {
      averageLevel = '상';
    } else if (levelCounts['하'] >= performances.length / 2) {
      averageLevel = '하';
    } else {
      averageLevel = '중';
    }
    
    this._currentStudent = {
      ...student,
      averageLevel
    };
  }

  get messages(): PersonaChatMessage[] {
    return this._messages;
  }

  get currentStudent(): StudentPersona | null {
    return this._currentStudent;
  }

  private async analyzeMessageType(messageText: string): Promise<'learning_tip' | 'emotional_support'> {
    try {
      const embeddingResult = await EmbeddingService.calculateSimilarities(messageText);
      const maxSimilarity = embeddingResult.similarities[0]?.similarity || 0;
      
      if (maxSimilarity >= 0.6) {
        if (embeddingResult.category === '학습팁' || embeddingResult.category === '학습 방법/전략') {
          return 'learning_tip';
        } else if (embeddingResult.category === '동기부여/정서') {
          return 'emotional_support';
        }
      }
      
      // 기본값으로 학습팁 반환
      return 'learning_tip';
    } catch (error) {
      console.error('메시지 타입 분석 오류:', error);
      return 'learning_tip';
    }
  }

  private getPromptForStudent(type: 'learning_tip' | 'emotional_support'): string {
    if (!this._currentStudent || !this._currentStudent.averageLevel) {
      return this.prompts.find(p => p.level === '중' && p.type === type)?.prompt || '';
    }

    return this.prompts.find(
      p => p.level === this._currentStudent?.averageLevel && p.type === type
    )?.prompt || '';
  }

  async sendMessage(messageText: string) {
    if (!messageText.trim() || !this._currentStudent) return { success: false };
    if (this.isLoading) return { success: false };

    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageType = await this.analyzeMessageType(messageText);

    const userMessage: PersonaChatMessage = {
      id: messageId,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      type: messageType,
      level: this._currentStudent.averageLevel
    };

    this._messages = [...this._messages, userMessage];
    this.isLoading = true;

    try {
      const systemPrompt = this.getPromptForStudent(messageType);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemPrompt,
          userMessage: messageText
        })
      });

      if (!response.ok) throw new Error('응답 오류');

      const result = await response.json();

      const assistantMessage: PersonaChatMessage = {
        id: `${messageId}-response`,
        role: 'assistant',
        content: result.content,
        timestamp: new Date(),
        type: messageType,
        level: this._currentStudent.averageLevel
      };

      this._messages = [...this._messages, assistantMessage];
      return { success: true };
    } catch (error) {
      console.error('채팅 처리 오류:', error);
      const errorMessage: PersonaChatMessage = {
        id: `${messageId}-error`,
        role: 'system',
        content: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date(),
        isError: true,
        type: messageType
      };
      this._messages = [...this._messages, errorMessage];
      return { success: false, error };
    } finally {
      this.isLoading = false;
    }
  }

  getMessages(): PersonaChatMessage[] {
    return this._messages.filter(msg => !msg.isDeleted);
  }

  getLoadingState(): boolean {
    return this.isLoading;
  }

  updateStreamingMessage(index: number, text: string): void {
    this._messages = this._messages.map((msg, i) => {
      if (i === index) {
        return {
          ...msg,
          content: text,
          isStreaming: false
        };
      }
      return msg;
    });
  }
} 