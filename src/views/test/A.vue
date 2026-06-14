<template>
  <div>
    <h1>TestA.</h1>
    <hr />
    <n-button @click="testMessage">Test A</n-button>
    <hr />
    <n-flex>
      <SvgIcon icon="HomeOutline" :size="50" />
      <span style="color: green">
        <SvgIcon icon="HomeOutline" :size="50" />
      </span>
    </n-flex>
  </div>
</template>

<script lang="ts" setup>
function testMessage() {
  window.$message?.success('Ok')
}
</script>
