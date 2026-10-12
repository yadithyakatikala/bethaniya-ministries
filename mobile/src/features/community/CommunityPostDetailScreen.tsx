import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { UpdateDetail } from '../updates/UpdateDetail';

type Props = NativeStackScreenProps<RootStackParamList, 'CommunityPostDetail'>;

/**
 * Community post detail -- the same "pass the full object as a route param"
 * reasoning as an announcement's, and the same SCREEN:
 * ../updates/UpdateDetail.tsx. The church's two kinds of update differ only
 * in their label.
 */
export function CommunityPostDetailScreen({ navigation, route }: Props) {
  const { post } = route.params;
  return (
    <UpdateDetail
      kind="post"
      title={post.title}
      content={post.content}
      imageUrl={post.imageUrl}
      createdAt={post.createdAt}
      onBack={() => navigation.goBack()}
      testPrefix="community-post-detail"
    />
  );
}
