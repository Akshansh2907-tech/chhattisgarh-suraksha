class ForumValidator {
  static validateTopicData(data) {
    const errors = [];

    // Title validation
    if (!data.title) {
      errors.push('Title is required');
    } else if (data.title.length < 5 || data.title.length > 200) {
      errors.push('Title must be between 5 and 200 characters');
    }

    // Content validation
    if (!data.content) {
      errors.push('Content is required');
    } else if (data.content.length < 10) {
      errors.push('Content must be at least 10 characters long');
    }

    // Category validation
    const validCategories = ['air_quality', 'weather', 'emergency', 'general'];
    if (!data.category) {
      errors.push('Category is required');
    } else if (!validCategories.includes(data.category)) {
      errors.push(`Category must be one of: ${validCategories.join(', ')}`);
    }

    // Tags validation
    if (data.tags) {
      if (!Array.isArray(data.tags)) {
        errors.push('Tags must be an array');
      } else {
        if (data.tags.length > 5) {
          errors.push('Maximum 5 tags allowed');
        }
        data.tags.forEach(tag => {
          if (typeof tag !== 'string') {
            errors.push('Tags must be strings');
          }
          if (tag.length < 2 || tag.length > 50) {
            errors.push('Tag length must be between 2 and 50 characters');
          }
          if (!/^[a-z0-9-]+$/.test(tag)) {
            errors.push('Tags can only contain lowercase letters, numbers, and hyphens');
          }
        });
      }
    }

    return errors;
  }

  static validateReplyData(data) {
    const errors = [];

    // Content validation
    if (!data.content) {
      errors.push('Content is required');
    } else if (data.content.length < 5) {
      errors.push('Content must be at least 5 characters long');
    }

    return errors;
  }

  static validateVoteData(data) {
    const errors = [];

    // Vote type validation
    if (!data.type) {
      errors.push('Vote type is required');
    } else if (!['up', 'down'].includes(data.type)) {
      errors.push('Vote type must be either "up" or "down"');
    }

    return errors;
  }

  static validatePaginationParams(params) {
    const errors = [];
    const { limit, offset } = params;

    // Limit validation
    if (limit !== undefined) {
      const limitNum = Number(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        errors.push('Limit must be a number between 1 and 100');
      }
    }

    // Offset validation
    if (offset !== undefined) {
      const offsetNum = Number(offset);
      if (isNaN(offsetNum) || offsetNum < 0) {
        errors.push('Offset must be a non-negative number');
      }
    }

    return errors;
  }

  static validateSearchParams(params) {
    const errors = [];
    const { search, category, sort, status } = params;

    // Search validation
    if (search && typeof search !== 'string') {
      errors.push('Search term must be a string');
    }

    // Category validation
    if (category && category !== 'all') {
      const validCategories = ['air_quality', 'weather', 'emergency', 'general'];
      if (!validCategories.includes(category)) {
        errors.push(`Category must be one of: all, ${validCategories.join(', ')}`);
      }
    }

    // Sort validation
    if (sort) {
      const validSortOptions = ['recent', 'popular', 'replies', 'views', 'oldest'];
      if (!validSortOptions.includes(sort)) {
        errors.push(`Sort must be one of: ${validSortOptions.join(', ')}`);
      }
    }

    // Status validation
    if (status) {
      const validStatusOptions = ['all', 'open', 'closed', 'resolved', 'pinned', 'locked'];
      if (!validStatusOptions.includes(status)) {
        errors.push(`Status must be one of: ${validStatusOptions.join(', ')}`);
      }
    }

    return errors;
  }
}

export default ForumValidator;