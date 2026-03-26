import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import AlertNotificationBar from '../../components/ui/AlertNotificationBar';
import ForumHeader from './components/ForumHeader';
import TopicCard from './components/TopicCard';
import CreateTopicModal from './components/CreateTopicModal';
import ForumSidebar from './components/ForumSlidebar';
import ForumFilters from './components/ForumFilters';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { forumAPI } from '../../utils/forum-api';
import { toast } from 'sonner';

const CommunityForum = () => {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [filteredTopics, setFilteredTopics] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filters, setFilters] = useState({
    sort: 'recent',
    time: 'all',
    status: 'all',
    category: 'all'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTopics();
  }, [selectedCategory, filters, searchQuery]);

  const loadTopics = async () => {
    setIsLoading(true);
    try {
      const response = await forumAPI.getAllTopics({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        sort: filters.sort,
        status: filters.status !== 'all' ? filters.status : undefined,
        time: filters.time !== 'all' ? filters.time : undefined,
        search: searchQuery,
        limit: 20
      });
      
      // Extract topics from the correct response structure
      const topicsData = response?.data?.data?.topics || [];
      
      // Map the topics to ensure all required fields are present
      const processedTopics = topicsData.map(topic => ({
        ...topic,
        author: {
          id: topic.author_id,
          name: topic.author_name || 'Anonymous'
        },
        replyCount: parseInt(topic.reply_count) || 0,
        upvotes: parseInt(topic.upvotes) || 0,
        downvotes: parseInt(topic.downvotes) || 0,
        viewCount: parseInt(topic.view_count) || 0,
        tags: Array.isArray(topic.tags) ? topic.tags : [],
        lastActivity: topic.updated_at || topic.created_at || new Date().toISOString(),
        preview: topic.content ? (topic.content.length > 200 ? topic.content.substring(0, 197) + '...' : topic.content) : ''
      }));

      setTopics(processedTopics);
      setFilteredTopics(processedTopics);
    } catch (err) {
      console.error('Failed to load topics:', err);
      // Show error notification
      // setError('Failed to load topics. Please try again.');
      setTopics([]);
      setFilteredTopics([]);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    filterTopics();
  }, [topics, searchQuery, selectedCategory, filters]);

  const filterTopics = () => {
    let filtered = [...topics];

        // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(topic =>
        (topic.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (topic.preview || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (topic.tags || []).some(tag => (tag || '').toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(topic => topic && topic.category === selectedCategory);
    }

    // Filter by status
    if (filters.status !== 'all') {
      switch (filters.status) {
        case 'pinned':
          filtered = filtered.filter(topic => topic.isPinned);
          break;
        case 'locked':
          filtered = filtered.filter(topic => topic.isLocked);
          break;
        case 'unanswered':
          filtered = filtered.filter(topic => topic.replyCount === 0);
          break;
        case 'solved':
          filtered = filtered.filter(topic => topic.replyCount > 0 && topic.upvotes > topic.downvotes);
          break;
      }
    }

    // Sort topics
    const getSortValue = (topic, key) => {
      if (!topic) return 0;
      switch (key) {
        case 'upvotes': return topic.upvotes || 0;
        case 'downvotes': return topic.downvotes || 0;
        case 'replyCount': return topic.replyCount || 0;
        case 'viewCount': return topic.viewCount || 0;
        default: return 0;
      }
    };

    switch (filters.sort) {
      case 'popular':
        filtered.sort((a, b) => 
          (getSortValue(b, 'upvotes') - getSortValue(b, 'downvotes')) - 
          (getSortValue(a, 'upvotes') - getSortValue(a, 'downvotes'))
        );
        break;
      case 'replies':
        filtered.sort((a, b) => getSortValue(b, 'replyCount') - getSortValue(a, 'replyCount'));
        break;
      case 'views':
        filtered.sort((a, b) => getSortValue(b, 'viewCount') - getSortValue(a, 'viewCount'));
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.lastActivity || 0) - new Date(b.lastActivity || 0));
        break;
      default: // recent
        filtered.sort((a, b) => new Date(b.lastActivity || Date.now()) - new Date(a.lastActivity || Date.now()));
    }

    setFilteredTopics(filtered);
  };

  const handleCreateTopic = async (topicData) => {
    try {
      const outgoing = {
        title: topicData.title,
        content: topicData.content,
        category: topicData.category,
        tags: topicData.tags
      };

      // Debug: log outgoing payload so we can inspect exact shape in the browser console
      console.debug('[CreateTopic] Outgoing payload:', outgoing);

      const response = await forumAPI.createTopic(outgoing);

      // Close modal and show success
      setIsCreateModalOpen(false);

      // Get the newly created topic ID from the response
      const newTopicId = response?.data?.data?.id;

      // Reload topics and then navigate
      await loadTopics();

      // Show a success toast after topics are refreshed so users see confirmation
      const createdTitle = response?.data?.data?.title || 'Topic created';
      toast.success('Topic created', { description: `"${createdTitle}" has been posted.` });

      // Navigate to the new topic if we have an ID
      if (newTopicId) {
        navigate(`/community-forum/topic/${newTopicId}`);
      }
    } catch (err) {
      console.error('Failed to create topic:', err);
      // Show error notification to user
      // setError('Failed to create topic. Please try again.');
    }
  };

  const handleTopicClick = (topicId) => {
    navigate(`/community-forum/topic/${topicId}`);
  };

  const calculateNewVotes = (topic, oldVote, newVote) => {
    let upvotes = topic.upvotes || 0;
    let downvotes = topic.downvotes || 0;

    // Remove old vote if exists
    if (oldVote === 'up') upvotes--;
    if (oldVote === 'down') downvotes--;

    // Add new vote if different from old
    if (oldVote !== newVote) {
      if (newVote === 'up') upvotes++;
      if (newVote === 'down') downvotes++;
    }

    return { upvotes, downvotes };
  };

  const handleVote = async (topicId, voteType) => {
    try {
      const currentTopic = topics.find(t => t.id === topicId);
      const oldVote = currentTopic?.userVote;
      
      setTopics(prev => prev.map(topic => {
        if (topic.id === topicId) {
          const newVotes = calculateNewVotes(topic, oldVote, voteType);
          return {
            ...topic,
            ...newVotes,
            userVote: voteType === oldVote ? null : voteType
          };
        }
        return topic;
      }));

      await forumAPI.voteTopic(topicId, voteType);
    } catch (err) {
      console.error('Failed to vote:', err);
      loadTopics();
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    if (newFilters && newFilters.category) {
      setSelectedCategory(newFilters.category);
    }
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setFilters(prev => ({ ...prev, category }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AlertNotificationBar />
      <div className="pt-16 flex h-screen">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsSidebarOpen(false)} />
            <div className="fixed left-0 top-16 bottom-0 w-80 z-50">
              <ForumSidebar
                onCategorySelect={handleCategorySelect}
                selectedCategory={selectedCategory}
              />
            </div>
          </div>
        )}

        {/* Desktop Sidebar */}
        <div className="hidden lg:block flex-shrink-0">
          <ForumSidebar
            onCategorySelect={handleCategorySelect}
            selectedCategory={selectedCategory}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <ForumHeader
            onCreatePost={() => setIsCreateModalOpen(true)}
            onSearch={handleSearch}
            onFilterChange={handleFilterChange}
          />

          <ForumFilters
            onFilterChange={handleFilterChange}
            activeFilters={filters}
          />

          {/* Mobile Sidebar Toggle */}
          <div className="lg:hidden p-4 border-b border-border">
            <Button
              variant="outline"
              onClick={() => setIsSidebarOpen(true)}
              iconName="Menu"
              iconPosition="left"
            >
              Categories & Filters
            </Button>
          </div>

          {/* Topics List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {isLoading ? (
                <div className="space-y-4">
              {[...Array(6)].map((_, index) => (
                    <div key={index} className="bg-card border border-border rounded-lg p-6 animate-pulse">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-8 h-8 bg-muted rounded-full" />
                        <div className="w-24 h-4 bg-muted rounded" />
                      </div>
                      <div className="w-3/4 h-6 bg-muted rounded mb-2" />
                      <div className="w-full h-4 bg-muted rounded mb-4" />
                      <div className="flex justify-between">
                        <div className="flex space-x-4">
                          <div className="w-16 h-4 bg-muted rounded" />
                          <div className="w-16 h-4 bg-muted rounded" />
                        </div>
                        <div className="w-20 h-4 bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredTopics.length > 0 ? (
                <div className="space-y-4">
                  {filteredTopics.map((topic) => (
                    <TopicCard
                      key={topic.id}
                      topic={topic}
                      onTopicClick={handleTopicClick}
                      onVote={handleVote}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Icon name="MessageCircle" size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No topics found</h3>
                  <p className="text-muted-foreground mb-6">
                    {searchQuery || selectedCategory !== 'all' ?'Try adjusting your search or filters' :'Be the first to start a discussion in this community'}
                  </p>
                  <Button
                    variant="default"
                    onClick={() => setIsCreateModalOpen(true)}
                    iconName="Plus"
                    iconPosition="left"
                  >
                    Create New Topic
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <CreateTopicModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTopic}
      />
    </div>
  );
};

export default CommunityForum;