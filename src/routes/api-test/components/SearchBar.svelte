<!-- src/routes/api-test/components/SearchBar.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let placeholder: string = "검색어를 입력하세요...";
  export let value: string = "";
  export let debounceTime: number = 300;
  export let totalCount: number = 0;
  export let isIndividualMode: boolean = false;
  export let showSearchResults: boolean = false;
  
  const dispatch = createEventDispatcher<{
    search: { query: string };
    clear: void;
  }>();
  
  function handleSubmit(event: Event) {
    event.preventDefault();
    if (value.trim()) {
      dispatch('search', { query: value });
    }
  }
  
  function clearSearch() {
    value = "";
    dispatch('clear');
  }
</script>

<div class="mb-6">
  <div class="flex justify-between items-center mb-3">
    <h2 class="text-lg font-semibold">검색</h2>
    <span class="px-2 py-1 bg-gray-100 text-sm rounded-full">
      {isIndividualMode ? '단독 수행' : '배치 수행'}
    </span>
  </div>
  <div class="mb-4">
    <form on:submit={handleSubmit} class="relative">
      <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <svg class="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
        </svg>
      </div>
      <input
        type="search"
        bind:value
        class="block w-full p-2 pl-10 pr-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-green-500 focus:border-green-500"
        {placeholder}
      />
      {#if value}
        <button 
          type="button" 
          class="absolute inset-y-0 right-0 flex items-center pr-3"
          on:click={clearSearch}
        >
          <svg class="w-4 h-4 text-gray-500 hover:text-gray-700" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
          </svg>
        </button>
      {/if}
      <button type="submit" class="hidden">Search</button>
    </form>
    
    {#if value && showSearchResults}
      <p class="mt-2 text-sm text-gray-600">
        "{value}" 검색 결과: {totalCount}개
        {#if totalCount > 0}
          <button 
            class="ml-2 text-blue-500 hover:text-blue-700 underline"
            on:click={clearSearch}
          >
            검색 초기화
          </button>
        {/if}
      </p>
    {/if}
  </div>
</div> 