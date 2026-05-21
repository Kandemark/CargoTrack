import { useState, useEffect, useRef } from 'react'
import { FlatList, type FlatListProps, type ListRenderItemInfo } from 'react-native'
import Animated, { FadeInUp, Layout } from 'react-native-reanimated'

interface StaggeredListProps<T> extends FlatListProps<T> {
  staggerDelay?: number
}

function AnimatedItem<T>({
  info,
  renderItem,
  staggerDelay,
}: {
  info: ListRenderItemInfo<T>
  renderItem: (info: ListRenderItemInfo<T>) => React.ReactElement | null
  staggerDelay: number
}) {
  const delay = info.index * staggerDelay
  const entering = FadeInUp.delay(delay).springify().damping(15)

  return (
    <Animated.View entering={entering} layout={Layout.springify()}>
      {renderItem(info)}
    </Animated.View>
  )
}

export default function StaggeredList<T>({
  staggerDelay = 60,
  data,
  renderItem,
  ...rest
}: StaggeredListProps<T>) {
  const [ready, setReady] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    timerRef.current = setTimeout(() => { setReady(true) }, 50)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return (
    <FlatList
      data={data}
      renderItem={(info) =>
        ready && renderItem ? (
          <AnimatedItem<T> info={info} renderItem={renderItem} staggerDelay={staggerDelay} />
        ) : (
          renderItem ? renderItem(info) : null
        )
      }
      {...rest}
    />
  )
}
