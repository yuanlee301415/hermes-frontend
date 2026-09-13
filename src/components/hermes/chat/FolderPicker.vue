<!--
文件目录选择器
-->
<script lang="ts">
import type { TreeOption } from 'naive-ui'
import { getFoldersApi } from '@/api/files.ts'

class FolderTree {
  path: string
  fullPath: string
  name: string
  folders: FolderTree[]
  isLeaf?: boolean
  constructor(_: FolderTree) {
    this.name = _.name
    this.path = _.path
    this.fullPath = _.fullPath
    this.isLeaf = _.isLeaf ?? false
    this.folders = _.folders?.map(_ => new FolderTree(_))
  }
}
</script>

<script setup lang="ts">
const path = defineModel<string>('path')
const tree = ref<FolderTree[]>([])
const expandedKeys = ref<string[]>([])
const selectedKeys = computed(() => [path.value!])

getRoot()

/**
 * 获取工作目录根目录
 */
async function getRoot() {
  const res = await getFoldersApi()
  tree.value[0] = new FolderTree({
    path: '',
    fullPath: res.base,
    name: res.base,
    isLeaf: false,
    folders: res.folders as unknown as FolderTree[]
  })
  expandedKeys.value = [res.base]
}

/**
 * 获取子目录
 */
async function handleLoadFolders(node: TreeOption) {
  const res = await getFoldersApi((node as unknown as FolderTree).path)
  const tree = new FolderTree(res as unknown as FolderTree)
  node.folders = tree.folders
}

function handleUpdateKeys(keys: string[]) {
  path.value = keys[0]
}

</script>

<template>
<div class="folder-picker">
  <n-input v-model:value="path" clearable />
  <div class="folder-tree">
    <n-tree
      :data="tree"
      :selected-keys="selectedKeys"
      :on-load="handleLoadFolders"
      key-field="fullPath"
      label-field="name"
      children-field="folders"
      block-line
      show-line
      :default-expanded-keys="expandedKeys"
      @update:selectedKeys="handleUpdateKeys"
    />
  </div>
</div>
</template>

<style scoped lang="less">
.folder-picker {
  border: 1px solid #ffffff1a;
  border-radius: 6px;
  padding: 8px;
  background-color: #00000033;
  max-height: 360px;
  overflow-y: hidden;
  display: flex;
  flex-direction: column;
  .folder-tree {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
}
</style>
