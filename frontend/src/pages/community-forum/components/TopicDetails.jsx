import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import Header from '../../../components/ui/Header';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { forumAPI } from '../../../utils/forum-api';

const ReplyCard = ({ reply, author }) => {
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <div className="flex items-start space-x-3 mb-3">
        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
          {author?.name?.charAt(0)?.toUpperCase()}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-medium">{author?.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatTimeAgo(reply?.created_at)}
            </span>
          </div>
          <p className="text-sm mt-1">{reply?.content}</p>
        </div>
      </div>
    </div>
  );
};

const TopicDetails = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [topic, setTopic] = useState(null);
  const [replies, setReplies] = useState([]);
  const [newReply, setNewReply] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTopic();
    loadReplies();
  }, [topicId]);

  const loadTopic = async () => {
    try {
      const response = await forumAPI.getTopicById(topicId);
      setTopic(response.data);
    } catch (err) {
      console.error('Failed to load topic:', err);
      setError('Failed to load topic. Please try again.');
    }
  };

  const loadReplies = async () => {
    try {
      const response = await forumAPI.getReplies(topicId);
      setReplies(response.data.replies);
    } catch (err) {
      console.error('Failed to load replies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (voteType) => {
    try {
      const response = await forumAPI.voteTopic(topicId, voteType);
      setTopic(prev => ({
        ...prev,
        upvotes: response.data.upvotes,
        downvotes: response.data.downvotes,
        userVote: response.data.userVote
      }));
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!newReply.trim()) return;

    try {
      await forumAPI.addReply(topicId, newReply);
      setNewReply('');
      loadReplies();
    } catch (err) {
      console.error('Failed to add reply:', err);
    }
  };

  const getCategoryColor = (category) => {
    const colorMap = {
      air_quality: 'text-blue-600 bg-blue-50',
      water_quality: 'text-cyan-600 bg-cyan-50',
      sustainability: 'text-green-600 bg-green-50',
      policy: 'text-purple-600 bg-purple-50',
      green_spaces: 'text-emerald-600 bg-emerald-50',
      waste_management: 'text-orange-600 bg-orange-50',
      climate_change: 'text-red-600 bg-red-50',
      community_events: 'text-indigo-600 bg-indigo-50'
    };
    return colorMap?.[category] || 'text-gray-600 bg-gray-50';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-16 container mx-auto px-4">
          <div className="animate-pulse space-y-4 py-8">
            <div className="h-8 bg-muted rounded w-3/4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-4 bg-muted rounded w-full"></div>
              <div className="h-4 bg-muted rounded w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-16 container mx-auto px-4">
          <div className="text-center py-12">
            <Icon name="AlertTriangle" size={48} className="mx-auto text-error mb-4" />
            <h3 className="text-lg font-medium mb-2">{error}</h3>
            <Button
              variant="outline"
              onClick={() => navigate('/community-forum')}
              iconName="ArrowLeft"
              iconPosition="left"
            >
              Back to Forum
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!topic) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-16 container mx-auto px-4">
        <div className="max-w-4xl mx-auto py-8">
          {/* Back button */}
          <Button
            variant="ghost"
            className="mb-6"
            onClick={() => navigate('/community-forum')}
            iconName="ArrowLeft"
            iconPosition="left"
          >
            Back to Forum
          </Button>

          {/* Topic header */}
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${getCategoryColor(topic.category)}`}>
                {topic.category?.replace('_', ' ')}
              </span>
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  iconName="ThumbsUp"
                  iconPosition="left"
                  onClick={() => handleVote('up')}
                  className={topic.userVote === 'up' ? 'text-primary' : ''}
                >
                  {topic.upvotes}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconName="ThumbsDown"
                  iconPosition="left"
                  onClick={() => handleVote('down')}
                  className={topic.userVote === 'down' ? 'text-error' : ''}
                >
                  {topic.downvotes}
                </Button>
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-4">{topic.title}</h1>
            <div className="prose max-w-none mb-6">
              {topic.content}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                  {topic.author?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <span className="font-medium">{topic.author?.name}</span>
                  <div className="text-xs text-muted-foreground">
                    Posted {new Date(topic.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {topic.tags?.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 text-xs bg-muted text-muted-foreground rounded-md"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Replies section */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center space-x-2">
              <Icon name="MessageCircle" />
              <span>Replies ({replies.length})</span>
            </h2>

            {/* Reply form */}
            {user && (
              <form onSubmit={handleReplySubmit} className="mb-6">
                <div className="bg-card border border-border rounded-lg p-4">
                  <textarea
                    value={newReply}
                    onChange={(e) => setNewReply(e.target.value)}
                    placeholder="Write your reply..."
                    className="w-full min-h-[100px] bg-background border border-input px-3 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex justify-end mt-4">
                    <Button
                      type="submit"
                      disabled={!newReply.trim()}
                      iconName="Send"
                      iconPosition="right"
                    >
                      Post Reply
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* Replies list */}
            <div className="space-y-4">
              {replies.map((reply) => (
                <ReplyCard
                  key={reply.id}
                  reply={reply}
                  author={reply.author}
                />
              ))}
              {replies.length === 0 && (
                <div className="text-center py-12">
                  <Icon name="MessageCircle" size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No replies yet</h3>
                  <p className="text-muted-foreground">Be the first to reply to this topic!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicDetails;