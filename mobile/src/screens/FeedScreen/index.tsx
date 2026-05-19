import React, { useState, useRef, useCallback } from 'react'
import { FlatList, Dimensions, ViewToken, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Post } from '../../types'
import { useFeed } from '../../hooks/useFeed'
import FeedItem from './FeedItem'
import FeedHeader from './FeedHeader'
import CommentSheet from '../../components/CommentSheet'
import { colors } from '../../theme'

const { height } = Dimensions.get('window')

export default function FeedScreen() {
  const { posts, loadMore, refresh } = useFeed()
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const viewConfig = useRef({ itemVisiblePercentThreshold: 60 })

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0)
  })

  useFocusEffect(useCallback(() => { refresh() }, []))

  return (
    <>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <FeedItem post={item} isActive={index === activeIndex} onCommentPress={setSelectedPost} />
        )}
        pagingEnabled
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewable.current}
        viewabilityConfig={viewConfig.current}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        style={styles.list}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
      />
      <FeedHeader onTabChange={() => {}} />
      {selectedPost && (
        <CommentSheet post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.black },
})
