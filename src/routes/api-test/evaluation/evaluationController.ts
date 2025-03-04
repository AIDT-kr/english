// src/routes/api-test/evaluation/evaluationController.ts
import {
  loadBatchSummaries,
  loadBatchResponses,
  loadBatchStatistics,
  handleEvaluation as updateEvaluation,
  saveRagasResults,
  loadAllBatchResponses
} from './evaluationService';
import { updateCategoryName } from '../db';
import {
  batchSummaries,
  selectedBatchId,
  responses,
  loading,
  responsesLoading,
  error,
  batchStats,
  currentPage,
  totalItems,
  pageSize,
  updateProgress,
  updateMessage,
  isCancelRequested,
  isUpdateComplete,
  updateCompleteMessage,
  isUpdatingCategory,
  isRunningBatchAiTest,
  aiTestProgress,
  aiTestMessage,
  aiTestCancelRequested,
  isAiTestComplete,
  aiTestCompleteMessage,
  aiTestMode
} from './evaluationStore';
import { get } from 'svelte/store';
import type { ResponseData } from './types';

// Fetch batch summaries
export async function fetchBatchSummaries(): Promise<void> {
  try {
    loading.set(true);
    error.set(null);
    const summaries = await loadBatchSummaries();
    batchSummaries.set(summaries);
  } catch (e) {
    error.set(e instanceof Error ? e.message : '배치 목록을 불러오는데 실패했습니다.');
  } finally {
    loading.set(false);
  }
}

// Fetch batch responses
export async function fetchBatchResponses(batchId: string, page: number = 1): Promise<void> {
  try {
    const currentSelectedBatchId = get(selectedBatchId);
    
    if (currentSelectedBatchId !== batchId) {
      loading.set(true);
    } else {
      responsesLoading.set(true);
    }
    
    error.set(null);
    selectedBatchId.set(batchId);
    currentPage.set(page);
    
    console.log(`Fetching batch responses for batch ${batchId}, page ${page}, pageSize ${get(pageSize)}`);
    
    const result = await loadBatchResponses(batchId, page, get(pageSize));
    responses.set(result.data);
    totalItems.set(result.count);
    
    console.log(`Received ${result.data.length} responses out of ${result.count} total items`);
    
    if (get(loading)) {
      const stats = await loadBatchStatistics(batchId);
      batchStats.set(stats);
    }
    
  } catch (e) {
    error.set(e instanceof Error ? e.message : '응답을 불러오는데 실패했습니다.');
    console.error('응답 로드 오류:', e);
  } finally {
    loading.set(false);
    responsesLoading.set(false);
  }
}

// Handle evaluation
export async function handleEvaluation(responseId: number, feedback: 0 | 1, note: string = '', category?: string): Promise<void> {
  try {
    loading.set(true);
    error.set(null);
    await updateEvaluation(responseId, feedback, note, category);
    
    responses.update(currentResponses => 
      currentResponses.map(response => 
        response.id === responseId
          ? { 
              ...response, 
              human_feedback: feedback, 
              human_feedback_note: note,
              query_category: category || response.query_category,
              evaluated_at: new Date().toISOString()
            }
          : response
      )
    );

    const currentSelectedBatchId = get(selectedBatchId);
    if (currentSelectedBatchId) {
      const stats = await loadBatchStatistics(currentSelectedBatchId);
      batchStats.set(stats);
    }
  } catch (e) {
    error.set(e instanceof Error ? e.message : '평가 저장에 실패했습니다.');
  } finally {
    loading.set(false);
  }
}

// Save RAGAS evaluation results
export async function handleSaveRagasResults(id: number, results: any): Promise<void> {
  try {
    loading.set(true);
    error.set(null);
    await saveRagasResults(id, results);
    
    responses.update(currentResponses => 
      currentResponses.map(response => 
        response.id === id
          ? { 
              ...response, 
              ragas_feedback: results,
              evaluated_at: new Date().toISOString()
            }
          : response
      )
    );
  } catch (e) {
    error.set(e instanceof Error ? e.message : 'RAGAS 평가 결과 저장에 실패했습니다.');
  } finally {
    loading.set(false);
  }
}

// Handle category update
export async function handleCategoryUpdate(oldCategory: string, newCategory: string): Promise<void> {
  const currentSelectedBatchId = get(selectedBatchId);
  
  if (!currentSelectedBatchId || oldCategory === newCategory) return;
  
  try {
    isUpdatingCategory.set(true);
    updateProgress.set(0);
    updateMessage.set(`카테고리 "${oldCategory}"를 "${newCategory}"로 변경 중...`);
    isCancelRequested.set(false);
    isUpdateComplete.set(false);
    
    const result = await updateCategoryName(
      currentSelectedBatchId,
      oldCategory,
      newCategory,
      (processed, total) => {
        updateProgress.set(Math.round((processed / total) * 100));
        
        // Check for cancellation request
        if (get(isCancelRequested)) {
          throw new Error('사용자에 의해 취소됨');
        }
      }
    );
    
    isUpdateComplete.set(true);
    updateCompleteMessage.set(`카테고리 변경이 완료되었습니다. ${result.count}개의 항목이 업데이트되었습니다.`);
    
    // Reload batch statistics
    if (currentSelectedBatchId) {
      const stats = await loadBatchStatistics(currentSelectedBatchId);
      batchStats.set(stats);
      
      // Reload current page responses
      await fetchBatchResponses(currentSelectedBatchId, get(currentPage));
    }
    
  } catch (e) {
    if (e instanceof Error && e.message === '사용자에 의해 취소됨') {
      isUpdateComplete.set(true);
      updateCompleteMessage.set('카테고리 변경이 취소되었습니다.');
    } else {
      isUpdateComplete.set(true);
      updateCompleteMessage.set(`카테고리 변경 중 오류가 발생했습니다: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
  }
}

/**
 * 병렬로 AI 테스트를 실행하는 함수
 * @param responsesToProcess 처리할 응답 목록
 * @param concurrentLimit 동시에 처리할 최대 요청 수
 * @returns 처리 결과 (성공 및 실패 개수)
 */
async function runParallelAiTests(
  responsesToProcess: ResponseData[],
  concurrentLimit: number
): Promise<{ succeeded: number; failed: number; processed: number }> {
  const total = responsesToProcess.length;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  
  // 취소 요청 확인을 위한 함수
  const checkCancellation = () => {
    if (get(aiTestCancelRequested)) {
      throw new Error('사용자에 의해 취소됨');
    }
  };
  
  // 응답을 배치로 나누어 처리
  for (let i = 0; i < total; i += concurrentLimit) {
    checkCancellation();
    
    const batch = responsesToProcess.slice(i, i + concurrentLimit);
    const batchPromises = batch.map(async (response) => {
      try {
        // Run RAGAS test
        const apiResponse = await fetch('http://localhost:8001/evaluate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_input: response.input_text,
            response: response.response_text,
            metrics: ["answer_relevancy", "faithfulness"]
          }),
        });
        
        if (!apiResponse.ok) {
          throw new Error(`API 응답 오류: ${apiResponse.status}`);
        }
        
        const results = await apiResponse.json();
        
        // Save results
        await saveRagasResults(response.id, results);
        return { success: true, id: response.id };
      } catch (e) {
        console.error(`항목 ${response.id} 평가 중 오류:`, e);
        return { success: false, id: response.id, error: e };
      }
    });
    
    // 배치 내의 모든 요청을 병렬로 처리
    const batchResults = await Promise.all(batchPromises);
    
    // 결과 집계
    batchResults.forEach(result => {
      processed++;
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    });
    
    // 진행 상황 업데이트
    aiTestProgress.set(Math.round((processed / total) * 100));
    aiTestMessage.set(`${total}개 항목 중 ${processed}개 처리 중... (성공: ${succeeded}, 실패: ${failed})`);
  }
  
  return { succeeded, failed, processed };
}

/**
 * 배치 AI 테스트를 실행하는 함수
 * @param mode 테스트 모드 ('all' 또는 'pending')
 * @param concurrentRequests 동시에 처리할 요청 수
 */
export async function handleBatchAiTest(
  mode: 'all' | 'pending',
  concurrentRequests: number = 5
): Promise<void> {
  const currentSelectedBatchId = get(selectedBatchId);
  
  if (!currentSelectedBatchId) return;
  
  try {
    isRunningBatchAiTest.set(true);
    aiTestProgress.set(0);
    aiTestMessage.set(`${mode === 'all' ? '모든' : '미평가된'} 항목에 대해 AI 테스트 실행 중...`);
    aiTestCancelRequested.set(false);
    isAiTestComplete.set(false);
    aiTestMode.set(mode);
    
    // 동시 요청 수 유효성 검사
    const validConcurrentRequests = Math.max(1, Math.min(20, concurrentRequests));
    
    // Load all responses for the batch
    const allResponses = await loadAllBatchResponses(currentSelectedBatchId);
    
    // Filter responses based on mode
    const responsesToProcess = mode === 'all' 
      ? allResponses 
      : allResponses.filter(response => !response.ragas_feedback || Object.keys(response.ragas_feedback).length === 0);
    
    const total = responsesToProcess.length;
    
    aiTestMessage.set(`${total}개 항목 중 0개 처리 중... (동시 처리: ${validConcurrentRequests}개)`);
    
    // 병렬 처리 실행
    const { succeeded, failed, processed } = await runParallelAiTests(
      responsesToProcess,
      validConcurrentRequests
    );
    
    isAiTestComplete.set(true);
    aiTestCompleteMessage.set(`AI 테스트가 완료되었습니다. 총 ${total}개 항목 중 ${succeeded}개 성공, ${failed}개 실패했습니다.`);
    
    // Reload batch statistics
    if (currentSelectedBatchId) {
      const stats = await loadBatchStatistics(currentSelectedBatchId);
      batchStats.set(stats);
      
      // Reload current page responses
      await fetchBatchResponses(currentSelectedBatchId, get(currentPage));
    }
    
  } catch (e) {
    if (e instanceof Error && e.message === '사용자에 의해 취소됨') {
      isAiTestComplete.set(true);
      aiTestCompleteMessage.set('AI 테스트가 취소되었습니다.');
    } else {
      isAiTestComplete.set(true);
      aiTestCompleteMessage.set(`AI 테스트 중 오류가 발생했습니다: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
  }
} 