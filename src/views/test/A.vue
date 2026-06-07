<template>
  <div>
    <h1>TestA.</h1>
    <hr>
    <n-button @click="testMessage">Test A</n-button>
  </div>
</template>

<script lang="ts" setup>
function testMessage() {
  window.$message?.success('Ok')
}
</script>
